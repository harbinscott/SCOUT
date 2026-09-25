import { describe, expect, it } from 'vitest';
import { createCacheKey } from './cache-key.js';
import type { IsochroneRequest } from '../../../shared/types.js';

const request: IsochroneRequest = {
  destination: { latitude: 30.2672, longitude: -97.7431 }, durationMinutes: 30,
  travelMode: 'DRIVE', travelDirection: 'TO', routingPreference: 'TRAFFIC_AWARE',
  polygonFidelity: 'MEDIUM', enableSmoothing: true,
};

describe('createCacheKey', () => {
  it('is deterministic and includes material request fields', () => {
    expect(createCacheKey(request)).toBe(createCacheKey({ ...request, destination: { ...request.destination } }));
    expect(createCacheKey({ ...request, durationMinutes: 45 })).not.toBe(createCacheKey(request));
  });
});
