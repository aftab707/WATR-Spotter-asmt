/**
 * Typed API Client for Weather-Aware Truck Routing (WATR).
 *
 * Implements Section 5 API Contract with automatic mock mode fallback (VITE_USE_MOCK).
 */

import mockPlanFixture from './fixtures/plan.json';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
export const IS_MOCK_MODE = String(import.meta.env.VITE_USE_MOCK).toLowerCase() === 'true';

const MOCK_CITIES = [
  { label: 'Chicago, IL, USA', lat: 41.8781, lon: -87.6298 },
  { label: 'Denver, CO, USA', lat: 39.7392, lon: -104.9903 },
  { label: 'Milwaukee, WI, USA', lat: 43.0389, lon: -87.9065 },
  { label: 'Des Moines, IA, USA', lat: 41.5868, lon: -93.625 },
  { label: 'Omaha, NE, USA', lat: 41.2565, lon: -95.9345 },
  { label: 'Lincoln, NE, USA', lat: 40.8136, lon: -96.7026 },
  { label: 'Kansas City, MO, USA', lat: 39.0997, lon: -94.5786 },
  { label: 'Dallas, TX, USA', lat: 32.7767, lon: -96.797 },
];

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.fields = data?.fields || null;
  }
}

/**
 * Health check ping to verify backend connectivity.
 * @returns {Promise<{ status: string }>}
 */
export async function fetchHealth() {
  if (IS_MOCK_MODE) {
    return { status: 'ok', mode: 'mock' };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/health/`);
    if (!res.ok) {
      throw new ApiError(`Health check failed with status ${res.status}`, res.status);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Unable to connect to backend', 0);
  }
}

/**
 * Search geocoded places by query string.
 * @param {string} query
 * @returns {Promise<{ results: Array<{ label: string, lat: number, lon: number }> }>}
 */
export async function searchGeocode(query) {
  const trimmed = (query || '').trim();
  if (trimmed.length < 2) {
    return { results: [] };
  }

  if (IS_MOCK_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const lower = trimmed.toLowerCase();
    const matches = MOCK_CITIES.filter((c) => c.label.toLowerCase().includes(lower));
    return { results: matches.slice(0, 6) };
  }

  try {
    const url = `${API_BASE_URL}/api/geocode/?q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new ApiError(`Geocoding failed with status ${res.status}`, res.status);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Geocoding search failed', 0);
  }
}

/**
 * Plan weather-aware trip across up to 3 route alternatives.
 * @param {import('./types.js').PlanTripRequest} payload
 * @returns {Promise<import('./types.js').PlanTripResponse>}
 */
export async function planTrip(payload) {
  if (IS_MOCK_MODE) {
    // Simulate brief network latency for realistic UX
    await new Promise((resolve) => setTimeout(resolve, 350));
    return mockPlanFixture;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/plan/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMessage =
        data?.message ||
        (data?.error === 'validation' ? 'Please correct the invalid fields.' : `Request failed (HTTP ${res.status})`);
      throw new ApiError(errorMessage, res.status, data);
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Trip planning service unavailable', 0);
  }
}

/**
 * Return static mock plan fixture directly for testing and preview.
 * @returns {import('./types.js').PlanTripResponse}
 */
export function getMockPlanFixture() {
  return mockPlanFixture;
}
