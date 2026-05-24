import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DependencyCreate,
  DependencyUpdate,
  FeatureCreate,
  FeatureUpdate,
  ImprovementActionCreate,
  ImprovementActionUpdate,
  PICreate,
  RiskCreate,
  RiskUpdate,
} from '../../types';
import { api } from '../../api/index';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function resolveOk(data: unknown = null) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function resolveError(status: number, statusText: string, body?: unknown) {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: body !== undefined
      ? () => Promise.resolve(body)
      : () => Promise.reject(new Error('no body')),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe('GET methods', () => {
  it('listPIs calls GET /api/pi', async () => {
    resolveOk([]);
    await api.listPIs();
    expect(mockFetch).toHaveBeenCalledWith('/api/pi');
  });

  it('getPI calls GET /api/pi/:id', async () => {
    resolveOk({});
    await api.getPI('abc');
    expect(mockFetch).toHaveBeenCalledWith('/api/pi/abc');
  });

  it('listARTs calls GET /api/art', async () => {
    resolveOk([]);
    await api.listARTs();
    expect(mockFetch).toHaveBeenCalledWith('/api/art');
  });

  it('listTeams calls GET /api/team', async () => {
    resolveOk([]);
    await api.listTeams();
    expect(mockFetch).toHaveBeenCalledWith('/api/team');
  });

  it('listIterations calls GET /api/iterations?pi_id=...', async () => {
    resolveOk([]);
    await api.listIterations('pi1');
    expect(mockFetch).toHaveBeenCalledWith('/api/iterations?pi_id=pi1');
  });

  it('listFeatures calls GET /api/features?pi_id=...', async () => {
    resolveOk([]);
    await api.listFeatures('pi1');
    expect(mockFetch).toHaveBeenCalledWith('/api/features?pi_id=pi1');
  });

  it('listAllFeatures calls GET /api/features with no filter', async () => {
    resolveOk([]);
    await api.listAllFeatures();
    expect(mockFetch).toHaveBeenCalledWith('/api/features');
  });

  it('listStoriesByFeature calls GET /api/stories?feature_id=...', async () => {
    resolveOk([]);
    await api.listStoriesByFeature('feat1');
    expect(mockFetch).toHaveBeenCalledWith('/api/stories?feature_id=feat1');
  });

  it('listRisks calls GET /api/risks?pi_id=...', async () => {
    resolveOk([]);
    await api.listRisks('pi1');
    expect(mockFetch).toHaveBeenCalledWith('/api/risks?pi_id=pi1');
  });

  it('listDependencies calls GET /api/dependencies?pi_id=...', async () => {
    resolveOk([]);
    await api.listDependencies('pi1');
    expect(mockFetch).toHaveBeenCalledWith('/api/dependencies?pi_id=pi1');
  });

  it('listImprovementActions calls GET /api/improvement-actions?pi_id=...', async () => {
    resolveOk([]);
    await api.listImprovementActions('pi1');
    expect(mockFetch).toHaveBeenCalledWith('/api/improvement-actions?pi_id=pi1');
  });
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

describe('POST methods', () => {
  function postOpts(body: unknown) {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
  }

  it('createPI calls POST /api/pi with body', async () => {
    resolveOk({});
    const body: PICreate = {
      name: 'PI 1',
      art_id: 'art1',
      start_date: '2026-01-01',
      end_date: '2026-03-27',
    };
    await api.createPI(body);
    expect(mockFetch).toHaveBeenCalledWith('/api/pi', postOpts(body));
  });

  it('createFeature calls POST /api/features with body', async () => {
    resolveOk({});
    const body: FeatureCreate = {
      name: 'Feature 1',
      user_business_value: 8,
      time_criticality: 5,
      risk_reduction_opportunity_enablement: 3,
      job_size: 4,
    };
    await api.createFeature(body);
    expect(mockFetch).toHaveBeenCalledWith('/api/features', postOpts(body));
  });

  it('createRisk calls POST /api/risks with body', async () => {
    resolveOk({});
    const body: RiskCreate = { description: 'Risk 1', pi_id: 'pi1' };
    await api.createRisk(body);
    expect(mockFetch).toHaveBeenCalledWith('/api/risks', postOpts(body));
  });

  it('createDependency calls POST /api/dependencies with body', async () => {
    resolveOk({});
    const body: DependencyCreate = {
      description: 'Dep 1',
      pi_id: 'pi1',
      from_feature_id: 'feature1',
      to_feature_id: 'feature2',
    };
    await api.createDependency(body);
    expect(mockFetch).toHaveBeenCalledWith('/api/dependencies', postOpts(body));
  });

  it('createImprovementAction calls POST /api/improvement-actions with body', async () => {
    resolveOk({});
    const body: ImprovementActionCreate = {
      pi_id: 'pi1',
      problem_statement: 'Deploys take too long',
      root_cause: 'Manual release checks',
      action: 'Automate deployment pipeline',
      owner: 'Platform',
      status: 'open',
    };
    await api.createImprovementAction(body);
    expect(mockFetch).toHaveBeenCalledWith('/api/improvement-actions', postOpts(body));
  });
});

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

describe('PATCH methods', () => {
  function patchOpts(body: unknown) {
    return {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
  }

  it('updateFeature calls PATCH /api/features/:id', async () => {
    resolveOk({});
    const body: FeatureUpdate = { name: 'Updated Feature' };
    await api.updateFeature('f1', body);
    expect(mockFetch).toHaveBeenCalledWith('/api/features/f1', patchOpts(body));
  });

  it('updateRisk calls PATCH /api/risks/:id', async () => {
    resolveOk({});
    const body: RiskUpdate = { roam_status: 'owned', owner: 'Alice' };
    await api.updateRisk('r1', body);
    expect(mockFetch).toHaveBeenCalledWith('/api/risks/r1', patchOpts(body));
  });

  it('updateDependency calls PATCH /api/dependencies/:id', async () => {
    resolveOk({});
    const body: DependencyUpdate = { status: 'in_progress' };
    await api.updateDependency('d1', body);
    expect(mockFetch).toHaveBeenCalledWith('/api/dependencies/d1', patchOpts(body));
  });

  it('updateImprovementAction calls PATCH /api/improvement-actions/:id', async () => {
    resolveOk({});
    const body: ImprovementActionUpdate = { status: 'done', owner: 'RTE' };
    await api.updateImprovementAction('ia1', body);
    expect(mockFetch).toHaveBeenCalledWith('/api/improvement-actions/ia1', patchOpts(body));
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

describe('DELETE methods', () => {
  const deleteOpts = { method: 'DELETE' };

  it('deletePI calls DELETE /api/pi/:id', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await api.deletePI('pi1');
    expect(mockFetch).toHaveBeenCalledWith('/api/pi/pi1', deleteOpts);
  });

  it('deleteFeature calls DELETE /api/features/:id', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await api.deleteFeature('f1');
    expect(mockFetch).toHaveBeenCalledWith('/api/features/f1', deleteOpts);
  });

  it('deleteRisk calls DELETE /api/risks/:id', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await api.deleteRisk('r1');
    expect(mockFetch).toHaveBeenCalledWith('/api/risks/r1', deleteOpts);
  });

  it('deleteDependency calls DELETE /api/dependencies/:id', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await api.deleteDependency('d1');
    expect(mockFetch).toHaveBeenCalledWith('/api/dependencies/d1', deleteOpts);
  });

  it('deleteImprovementAction calls DELETE /api/improvement-actions/:id', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await api.deleteImprovementAction('ia1');
    expect(mockFetch).toHaveBeenCalledWith('/api/improvement-actions/ia1', deleteOpts);
  });
});

// ---------------------------------------------------------------------------
// Error logging
// ---------------------------------------------------------------------------

describe('error logging', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('logs console.warn on 4xx response', async () => {
    resolveError(404, 'Not Found', { detail: 'not found' });
    await expect(api.listPIs()).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('→ 404'),
      expect.any(String),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs console.error on 5xx response', async () => {
    resolveError(500, 'Internal Server Error');
    await expect(api.listPIs()).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('→ 500'),
      expect.any(String),
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs console.error on network error', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    await expect(api.listPIs()).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('network error'),
      expect.any(TypeError),
    );
  });

  it('log message includes method and path', async () => {
    resolveError(422, 'Unprocessable Entity', { detail: 'bad input' });
    const body: PICreate = { name: 'X', art_id: 'a', start_date: '2026-01-01', end_date: '2026-03-27' };
    await expect(api.createPI(body)).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('POST /api/pi'),
      expect.any(String),
    );
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('surfaces detail string from a 404 response', async () => {
    resolveError(404, 'Not Found', { detail: "PI 'abc' not found" });
    await expect(api.listPIs()).rejects.toThrow("PI 'abc' not found");
  });

  it('surfaces detail string from a 409 conflict response', async () => {
    resolveError(409, 'Conflict', { detail: 'PI is already active' });
    const body: PICreate = { name: 'X', art_id: 'a', start_date: '2026-01-01', end_date: '2026-03-27' };
    await expect(api.createPI(body)).rejects.toThrow('PI is already active');
  });

  it('formats validation error array from a 422 response', async () => {
    resolveError(422, 'Unprocessable Entity', {
      detail: [
        { loc: ['body', 'name'], msg: 'Field required', type: 'missing' },
        { loc: ['body', 'job_size'], msg: 'Input should be less than or equal to 13', type: 'less_than_equal' },
      ],
    });
    await expect(api.updateFeature('f1', {})).rejects.toThrow(
      'name: Field required; job_size: Input should be less than or equal to 13',
    );
  });

  it('falls back to status text when response body is not JSON', async () => {
    resolveError(500, 'Internal Server Error');
    await expect(api.deletePI('x')).rejects.toThrow('500: Internal Server Error');
  });

  it('strips "body" segment from validation error loc path', async () => {
    resolveError(422, 'Unprocessable Entity', {
      detail: [{ loc: ['body', 'start_date'], msg: 'Invalid date format', type: 'value_error' }],
    });
    await expect(api.createPI({ name: 'X', art_id: 'a', start_date: 'bad', end_date: '2026-03-27' }))
      .rejects.toThrow('start_date: Invalid date format');
  });
});
