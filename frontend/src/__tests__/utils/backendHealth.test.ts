import { describe, expect, it } from 'vitest';
import { isBackendUnavailable } from '../../utils/backendHealth';

describe('isBackendUnavailable', () => {
  describe('network errors → true', () => {
    it('returns true for TypeError (fetch network failure)', () => {
      expect(isBackendUnavailable(new TypeError('Failed to fetch'))).toBe(true);
    });

    it('returns true for any TypeError regardless of message', () => {
      expect(isBackendUnavailable(new TypeError())).toBe(true);
    });
  });

  describe('gateway errors → true', () => {
    it('returns true for 502 Bad Gateway', () => {
      expect(isBackendUnavailable(new Error('502: Bad Gateway'))).toBe(true);
    });

    it('returns true for 503 Service Unavailable', () => {
      expect(isBackendUnavailable(new Error('503: Service Unavailable'))).toBe(true);
    });

    it('returns true for 504 Gateway Timeout', () => {
      expect(isBackendUnavailable(new Error('504: Gateway Timeout'))).toBe(true);
    });
  });

  describe('application errors → false', () => {
    it('returns false for 500 Internal Server Error (app crash, not gateway)', () => {
      expect(isBackendUnavailable(new Error('500: Internal Server Error'))).toBe(false);
    });

    it('returns false for 404 Not Found', () => {
      expect(isBackendUnavailable(new Error('404: Not Found'))).toBe(false);
    });

    it('returns false for 422 Unprocessable Entity', () => {
      expect(isBackendUnavailable(new Error('422: Unprocessable Entity'))).toBe(false);
    });

    it('returns false for 401 Unauthorized', () => {
      expect(isBackendUnavailable(new Error('401: Unauthorized'))).toBe(false);
    });

    it('returns false for a generic Error with no status code', () => {
      expect(isBackendUnavailable(new Error('something went wrong'))).toBe(false);
    });
  });

  describe('non-Error values → false', () => {
    it('returns false for a plain string', () => {
      expect(isBackendUnavailable('502: Bad Gateway')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isBackendUnavailable(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isBackendUnavailable(undefined)).toBe(false);
    });

    it('returns false for a number', () => {
      expect(isBackendUnavailable(502)).toBe(false);
    });
  });
});
