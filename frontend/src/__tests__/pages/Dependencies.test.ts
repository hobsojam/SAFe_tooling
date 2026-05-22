import { describe, expect, it } from 'vitest';
import { featureLabel } from '../../pages/Dependencies';
import type { Feature } from '../../types';

const baseFeature: Feature = {
  id: 'f1',
  name: 'Auth Service',
  description: '',
  pi_id: 'pi1',
  team_id: null,
  iteration_id: null,
  status: 'backlog',
  acceptance_criteria: '',
  nfr: '',
  user_business_value: 5,
  time_criticality: 5,
  risk_reduction_opportunity_enablement: 5,
  job_size: 5,
  cost_of_delay: 15,
  wsjf_score: 3,
};

describe('featureLabel', () => {
  it('returns just the feature name when team_id is null', () => {
    expect(featureLabel(baseFeature, {})).toBe('Auth Service');
  });

  it('returns just the feature name when team_id not in map', () => {
    const f = { ...baseFeature, team_id: 'unknown-team' };
    expect(featureLabel(f, {})).toBe('Auth Service');
  });

  it('returns "name (team)" when team is found in map', () => {
    const f = { ...baseFeature, team_id: 't1' };
    expect(featureLabel(f, { t1: 'Alpha Team' })).toBe('Auth Service (Alpha Team)');
  });

  it('returns just the name when team maps to empty string', () => {
    const f = { ...baseFeature, team_id: 't1' };
    expect(featureLabel(f, { t1: '' })).toBe('Auth Service');
  });
});
