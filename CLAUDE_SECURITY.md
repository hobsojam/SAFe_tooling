# Security Guidelines for Claude

These rules apply whenever you are working in this repository. Follow them without exception unless the user explicitly overrides a specific rule with a clear reason.

## Database

- **Never read from or write to `~/.safe_tooling/db.json`** during development or testing. Always use `--db-path` with a `tmp_path` fixture.
- **Never call `db.drop_tables()`, `db.clear_cache()`, or `table.truncate()`** on any database that could be the real user database. If cleanup is needed in tests, use the `tmp_path` fixture — it is automatically discarded by pytest.
- **Never delete or overwrite `~/.safe_tooling/db.json`** unless the user explicitly asks for a data reset and confirms they understand it is destructive.
- If you suspect test data leaked into the real DB (e.g. via a bug like the `db or get_db()` falsy issue), report it to the user before clearing anything.

## Input sanitisation — XSS / HTML injection

- **All free-text `str` fields on domain models and API schemas must use `ShortText` or `LongText` from `safe.models.base`, never plain `str`.**
  - `ShortText` — strips HTML tags + `max_length=200`. Use for single-line fields: `name`, `owner`.
  - `LongText` — strips HTML tags + `max_length=2000`. Use for multi-line fields: `description`, `acceptance_criteria`, `notes`, `problem_statement`, `root_cause`, `action`.
- The sanitiser strips `<tag>` delimiters via a `BeforeValidator`; text content between tags is kept as plain text (e.g. `<b>foo</b>` → `foo`).
- ID/FK fields (`pi_id`, `team_id`, UUIDs) are **not** user-supplied free text — leave them as plain `str`.
- When adding a new model or schema field, ask: is this a free-text string a user types? If yes, use `ShortText` or `LongText`. If it's an enum, ID, date, or number, leave it typed accordingly.
- Add sanitisation tests to `tests/test_sanitisation.py` for any new free-text fields — at minimum one tag-strip assertion and one `max_length` boundary check.

## CLI input handling

- **Never pass user-supplied strings to `subprocess`, `os.system`, or `eval`**. All CLI input must be handled through Typer option/argument parsing only.
- **Never interpolate user input into file paths** without sanitising with `Path(...).resolve()` and confirming the result stays within an allowed directory.
- Date strings from CLI options must be parsed with `date.fromisoformat()` inside a `try/except`; never `eval`-parsed.

## File system

- Code should only read and write inside the project directory and `~/.safe_tooling/`. Do not write to arbitrary paths supplied by user input without explicit confirmation.
- **Never delete files outside the project directory** without user confirmation.
- Do not create world-readable files containing sensitive data. The DB file at `~/.safe_tooling/db.json` may contain business-sensitive PI planning data.

## Git

- **Never force-push to `main`**.
- **Never commit secrets**, credentials, or real user database files (`*.json` under `~/.safe_tooling/`).
- The `.gitignore` must always exclude `~/.safe_tooling/` and `*.json` data files at the project root.
- Do not amend published commits on shared branches without user confirmation.

## Dependencies

- Do not add new dependencies without checking them against the existing stack in `pyproject.toml`.
- Do not pin dependencies to versions with known CVEs.
- All new dependencies must serve a clear purpose already described in the build plan; do not introduce speculative dependencies.

## Test safety

- Tests must never share state through module-level globals without an `autouse` reset fixture (`reset_state` pattern already established).
- Tests must never make real network calls.
- Do not disable pytest warnings or coverage thresholds without a documented reason.

## What to do if uncertain

If an action could be destructive, irreversible, or affects shared state (real DB, remote branches, CI config), **stop and ask the user for confirmation** before proceeding. The cost of pausing is always lower than the cost of data loss.
