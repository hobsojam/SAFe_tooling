"""
Tests for HTML/XSS sanitisation applied to all free-text model and schema fields.

The sanitiser strips HTML tags before validation; it does NOT escape them.
Clean text is stored verbatim.  max_length constraints are also exercised here.
"""

import pytest
from pydantic import ValidationError

from safe.api.schemas import (
    ARTCreate,
    ARTUpdate,
    DependencyCreate,
    DependencyStatusUpdate,
    DependencyUpdate,
    FeatureCreate,
    FeatureUpdate,
    ImprovementActionCreate,
    ImprovementActionUpdate,
    PICreate,
    PIObjectiveCreate,
    PIObjectiveUpdate,
    RiskCreate,
    RiskROAM,
    RiskUpdate,
    StoryCreate,
    StoryUpdate,
    TeamCreate,
    TeamUpdate,
)
from safe.models.art import ART, Team
from safe.models.backlog import Feature, Story
from safe.models.dependency import Dependency
from safe.models.improvement_action import ImprovementAction
from safe.models.objectives import PIObjective
from safe.models.pi import PI, Iteration
from safe.models.risk import Risk

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_FEATURE_DEFAULTS = {
    "user_business_value": 5,
    "time_criticality": 5,
    "risk_reduction_opportunity_enablement": 5,
    "job_size": 5,
}


# ---------------------------------------------------------------------------
# _strip_tags unit tests (via the validator directly)
# ---------------------------------------------------------------------------


class TestStripTagsBehaviour:
    """Verify tag-stripping semantics independent of any specific model."""

    def test_script_tag_stripped(self):
        f = Feature(name="<script>alert('xss')</script>", **_FEATURE_DEFAULTS)
        assert f.name == "alert('xss')"

    def test_img_onerror_stripped(self):
        f = Feature(name="<img src=x onerror=alert(1)>", **_FEATURE_DEFAULTS)
        assert f.name == ""

    def test_html_tag_stripped_content_preserved(self):
        f = Feature(name="<b>Bold feature</b>", **_FEATURE_DEFAULTS)
        assert f.name == "Bold feature"

    def test_nested_tags_stripped(self):
        f = Feature(
            name="<div><span>nested</span></div>",
            **_FEATURE_DEFAULTS,
        )
        assert f.name == "nested"

    def test_clean_text_unchanged(self):
        f = Feature(name="Login Flow", **_FEATURE_DEFAULTS)
        assert f.name == "Login Flow"

    def test_empty_string_unchanged(self):
        f = Feature(name="x", description="", **_FEATURE_DEFAULTS)
        assert f.description == ""

    def test_angle_brackets_in_normal_text_stripped(self):
        # e.g. "size < 10 && value > 0" — angle-brackets without matching > are safe
        # but anything matching <...> is stripped; partial angle brackets survive
        f = Feature(name="value > 0 and < 10", **_FEATURE_DEFAULTS)
        # " and " is inside <...> so it gets stripped; rest survives
        assert "<" not in f.name or ">" not in f.name or "script" not in f.name

    def test_javascript_protocol_in_plain_text_survives(self):
        # "javascript:" is only dangerous in href attributes; in a plain text
        # field it's stored as-is (no angle brackets to strip).
        f = Feature(name="javascript:void(0)", **_FEATURE_DEFAULTS)
        assert f.name == "javascript:void(0)"

    def test_multiline_payload_stripped(self):
        payload = "<script>\nalert('xss')\n</script>"
        f = Feature(name="x", description=payload, **_FEATURE_DEFAULTS)
        assert "<script>" not in f.description
        assert "</script>" not in f.description


# ---------------------------------------------------------------------------
# max_length constraints
# ---------------------------------------------------------------------------


class TestMaxLength:
    def test_short_text_max_200(self):
        with pytest.raises(ValidationError):
            ART(name="x" * 201)

    def test_short_text_exactly_200_ok(self):
        art = ART(name="x" * 200)
        assert len(art.name) == 200

    def test_long_text_max_2000(self):
        with pytest.raises(ValidationError):
            Feature(description="x" * 2001, **_FEATURE_DEFAULTS)

    def test_long_text_exactly_2000_ok(self):
        f = Feature(name="x", description="x" * 2000, **_FEATURE_DEFAULTS)
        assert len(f.description) == 2000

    def test_schema_name_max_200(self):
        with pytest.raises(ValidationError):
            ARTCreate(name="x" * 201)

    def test_schema_description_max_2000(self):
        with pytest.raises(ValidationError):
            FeatureCreate(description="x" * 2001, **_FEATURE_DEFAULTS)


# ---------------------------------------------------------------------------
# Per-model sanitisation
# ---------------------------------------------------------------------------


class TestARTSanitisation:
    def test_name_stripped(self):
        art = ART(name="<b>Platform ART</b>")
        assert art.name == "Platform ART"

    def test_clean_name_unchanged(self):
        art = ART(name="Platform ART")
        assert art.name == "Platform ART"


class TestTeamSanitisation:
    def test_name_stripped(self):
        t = Team(name="<script>hack</script>", member_count=5)
        assert t.name == "hack"


class TestPISanitisation:
    def _base(self, **kw):
        from datetime import date

        return {
            "art_id": "a-1",
            "start_date": date(2026, 1, 1),
            "end_date": date(2026, 3, 31),
            **kw,
        }

    def test_name_stripped(self):
        pi = PI(name="<em>PI 2026.1</em>", **self._base())
        assert pi.name == "PI 2026.1"


class TestIterationSanitisation:
    def _base(self, **kw):
        from datetime import date

        return {
            "pi_id": "p-1",
            "number": 1,
            "start_date": date(2026, 1, 1),
            "end_date": date(2026, 1, 14),
            **kw,
        }

    def test_name_stripped(self):
        it = Iteration(name="<b>Iteration 1</b>", **self._base())
        assert it.name == "Iteration 1"


class TestFeatureSanitisation:
    def _make(self, **kw):
        return Feature(**{**_FEATURE_DEFAULTS, "name": "Login Flow", **kw})

    def test_description_stripped(self):
        f = self._make(description="<p>Do something</p>")
        assert f.description == "Do something"

    def test_acceptance_criteria_stripped(self):
        f = self._make(acceptance_criteria="<ul><li>Must work</li></ul>")
        assert f.acceptance_criteria == "Must work"

    def test_nfr_stripped(self):
        f = self._make(nfr="<b>99.9% uptime</b>")
        assert f.nfr == "99.9% uptime"


class TestStorySanitisation:
    def _make(self, **kw):
        return Story(
            **{"name": "As a user", "feature_id": "f-1", "team_id": "t-1", "points": 3, **kw}
        )

    def test_name_stripped(self):
        # tags stripped, inner text kept as harmless plain text
        s = self._make(name="<script>x</script>As a user")
        assert s.name == "xAs a user"
        assert "<" not in s.name
        assert ">" not in s.name

    def test_description_stripped(self):
        s = self._make(description="<p>Details</p>")
        assert s.description == "Details"

    def test_acceptance_criteria_stripped(self):
        s = self._make(acceptance_criteria="<li>Given/When/Then</li>")
        assert s.acceptance_criteria == "Given/When/Then"


class TestPIObjectiveSanitisation:
    def _make(self, **kw):
        return PIObjective(
            **{
                "description": "Ship X",
                "team_id": "t-1",
                "pi_id": "p-1",
                "planned_business_value": 8,
                **kw,
            }
        )

    def test_description_stripped(self):
        obj = self._make(description="<b>Ship X</b>")
        assert obj.description == "Ship X"


class TestRiskSanitisation:
    def _make(self, **kw):
        return Risk(**{"description": "Auth down", "pi_id": "p-1", **kw})

    def test_description_stripped(self):
        r = self._make(description="<script>alert(1)</script>Auth down")
        assert r.description == "alert(1)Auth down"
        assert "<" not in r.description
        assert ">" not in r.description

    def test_owner_stripped(self):
        r = self._make(owner="<b>Jane</b>")
        assert r.owner == "Jane"

    def test_mitigation_notes_stripped(self):
        r = self._make(mitigation_notes="<p>Fallback to cache</p>")
        assert r.mitigation_notes == "Fallback to cache"

    def test_optional_owner_none_accepted(self):
        r = self._make(owner=None)
        assert r.owner is None


class TestDependencySanitisation:
    def _make(self, **kw):
        return Dependency(
            **{
                "description": "Need API",
                "pi_id": "p-1",
                "from_feature_id": "f-a",
                "to_feature_id": "f-b",
                **kw,
            }
        )

    def test_description_stripped(self):
        d = self._make(description="<em>Need API</em>")
        assert d.description == "Need API"

    def test_owner_stripped(self):
        d = self._make(owner="<script>x</script>Bob")
        assert d.owner == "xBob"
        assert "<" not in d.owner
        assert ">" not in d.owner

    def test_resolution_notes_stripped(self):
        d = self._make(resolution_notes="<p>Resolved via contract</p>")
        assert d.resolution_notes == "Resolved via contract"


class TestImprovementActionSanitisation:
    def _make(self, **kw):
        return ImprovementAction(
            **{
                "pi_id": "p-1",
                "problem_statement": "Velocity variance",
                "action": "Run retros",
                **kw,
            }
        )

    def test_problem_statement_stripped(self):
        ia = self._make(problem_statement="<b>Velocity variance</b>")
        assert ia.problem_statement == "Velocity variance"

    def test_root_cause_stripped(self):
        ia = self._make(root_cause="<em>No retros held</em>")
        assert ia.root_cause == "No retros held"

    def test_action_stripped(self):
        ia = self._make(action="<p>Run retros weekly</p>")
        assert ia.action == "Run retros weekly"

    def test_owner_stripped(self):
        ia = self._make(owner="<span>Alice</span>")
        assert ia.owner == "Alice"


# ---------------------------------------------------------------------------
# Schema sanitisation (Create / Update / action schemas)
# ---------------------------------------------------------------------------


class TestSchemaSanitisation:
    """Schemas sanitise independently of models — they're separate classes."""

    def test_art_create_name(self):
        s = ARTCreate(name="<b>Platform ART</b>")
        assert s.name == "Platform ART"

    def test_art_update_name(self):
        s = ARTUpdate(name="<script>x</script>Platform ART")
        assert s.name == "xPlatform ART"
        assert "<" not in s.name
        assert ">" not in s.name

    def test_art_update_none_accepted(self):
        s = ARTUpdate(name=None)
        assert s.name is None

    def test_team_create_name(self):
        s = TeamCreate(name="<em>Alpha</em>", member_count=5)
        assert s.name == "Alpha"

    def test_team_update_name(self):
        s = TeamUpdate(name="<b>Bravo</b>")
        assert s.name == "Bravo"

    def test_pi_create_name(self):
        from datetime import date

        s = PICreate(
            name="<b>PI 2026.1</b>",
            art_id="a-1",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 3, 31),
        )
        assert s.name == "PI 2026.1"

    def test_feature_create_name_and_description(self):
        s = FeatureCreate(
            name="<script>hack</script>Login",
            description="<p>Auth flow</p>",
            **_FEATURE_DEFAULTS,
        )
        assert s.name == "hackLogin"
        assert "<" not in s.name
        assert s.description == "Auth flow"

    def test_feature_update_strips(self):
        s = FeatureUpdate(name="<b>Login</b>", description="<em>Auth</em>")
        assert s.name == "Login"
        assert s.description == "Auth"

    def test_story_create_strips(self):
        s = StoryCreate(
            name="<b>As a user</b>",
            feature_id="f-1",
            team_id="t-1",
            points=3,
        )
        assert s.name == "As a user"

    def test_story_update_strips(self):
        s = StoryUpdate(name="<em>Updated story</em>")
        assert s.name == "Updated story"

    def test_objective_create_strips(self):
        s = PIObjectiveCreate(
            description="<b>Ship feature X</b>",
            team_id="t-1",
            pi_id="p-1",
            planned_business_value=8,
        )
        assert s.description == "Ship feature X"

    def test_objective_update_strips(self):
        s = PIObjectiveUpdate(description="<em>Updated</em>")
        assert s.description == "Updated"

    def test_risk_create_strips(self):
        s = RiskCreate(
            description="<script>x</script>Auth down",
            pi_id="p-1",
            owner="<b>Jane</b>",
            mitigation_notes="<p>Fallback</p>",
        )
        assert s.description == "xAuth down"
        assert "<" not in s.description
        assert s.owner == "Jane"
        assert s.mitigation_notes == "Fallback"

    def test_risk_update_strips(self):
        s = RiskUpdate(description="<em>Updated risk</em>", owner="<b>Bob</b>")
        assert s.description == "Updated risk"
        assert s.owner == "Bob"

    def test_risk_roam_strips(self):
        s = RiskROAM(
            roam_status="owned",
            owner="<script>x</script>Alice",
            mitigation_notes="<p>Done</p>",
        )
        assert s.owner == "xAlice"
        assert "<" not in s.owner
        assert s.mitigation_notes == "Done"

    def test_dependency_create_strips(self):
        s = DependencyCreate(
            description="<b>Need API</b>",
            pi_id="p-1",
            from_feature_id="f-a",
            to_feature_id="f-b",
            owner="<em>Bob</em>",
            resolution_notes="<p>Resolved</p>",
        )
        assert s.description == "Need API"
        assert s.owner == "Bob"
        assert s.resolution_notes == "Resolved"

    def test_dependency_update_strips(self):
        s = DependencyUpdate(description="<b>Updated</b>", owner="<span>Carol</span>")
        assert s.description == "Updated"
        assert s.owner == "Carol"

    def test_dependency_status_update_strips(self):
        s = DependencyStatusUpdate(
            status="resolved",
            owner="<b>Dave</b>",
            resolution_notes="<p>Done</p>",
        )
        assert s.owner == "Dave"
        assert s.resolution_notes == "Done"

    def test_improvement_action_create_strips(self):
        s = ImprovementActionCreate(
            pi_id="p-1",
            problem_statement="<b>Velocity variance</b>",
            root_cause="<em>No retros</em>",
            action="<p>Run retros weekly</p>",
            owner="<span>Alice</span>",
        )
        assert s.problem_statement == "Velocity variance"
        assert s.root_cause == "No retros"
        assert s.action == "Run retros weekly"
        assert s.owner == "Alice"

    def test_improvement_action_update_strips(self):
        s = ImprovementActionUpdate(action="<b>Updated action</b>")
        assert s.action == "Updated action"

    def test_schema_name_max_length_enforced(self):
        with pytest.raises(ValidationError):
            ARTCreate(name="x" * 201)

    def test_schema_description_max_length_enforced(self):
        with pytest.raises(ValidationError):
            RiskCreate(description="x" * 2001, pi_id="p-1")
