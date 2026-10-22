/**
 * TanStack React Query Hooks for Weather-Aware Truck Routing.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchHealth, searchGeocode, planTrip } from './client';

/**
 * Hook for backend health check & warm-up call on initial load.
 */
export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes keep-alive
    retry: 1,
  });
}

/**
 * Hook for place geocoding search.
 * @param {string} query
 * @param {boolean} [enabled=true]
 */
export function useGeocode(query, enabled = true) {
  const trimmed = (query || '').trim();
  return useQuery({
    queryKey: ['geocode', trimmed],
    queryFn: () => searchGeocode(trimmed),
    enabled: enabled && trimmed.length >= 2,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

/**
 * Mutation hook for trip planning.
 */
export function usePlanTrip() {
  return useMutation({
    mutationFn: (payload) => planTrip(payload),
  });
}
