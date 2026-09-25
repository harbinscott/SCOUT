import { describe, expect, it } from 'vitest';
import { createMockGeometry, MockIsochroneProvider } from './mock-provider.js';

const request = {
  destination: { latitude: 30.2672, longitude: -97.7431 }, durationMinutes: 20,
  travelMode: 'DRIVE' as const, travelDirection: 'TO' as const, routingPreference: 'TRAFFIC_AWARE' as const,
  polygonFidelity: 'MEDIUM' as const, enableSmoothing: true,
};

describe('MockIsochroneProvider', () => {
  it('creates irregular valid polygon output using the live contract', async () => {
    const geometry = createMockGeometry(request);
    expect(geometry.type).toBe('Polygon');
    expect(geometry.coordinates[0].length).toBeGreaterThan(12);
    const result = await new MockIsochroneProvider().generateIsochrone(request);
    expect(result.metadata.provider).toBe('mock');
  });
});
