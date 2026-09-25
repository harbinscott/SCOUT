import { describe, expect, it } from 'vitest';
import { isochroneRequestSchema } from './schemas.js';

const request = {
  destination: { latitude: 30, longitude: -97 }, durationMinutes: 60,
  travelMode: 'DRIVE', travelDirection: 'TO', routingPreference: 'TRAFFIC_AWARE',
  polygonFidelity: 'MEDIUM', enableSmoothing: true,
};

describe('isochroneRequestSchema', () => {
  it('accepts valid driving requests and rejects driving beyond 60 minutes', () => {
    expect(isochroneRequestSchema.safeParse(request).success).toBe(true);
    expect(isochroneRequestSchema.safeParse({ ...request, durationMinutes: 61 }).success).toBe(false);
  });
  it('rejects traffic awareness for walking', () => {
    expect(isochroneRequestSchema.safeParse({ ...request, travelMode: 'WALK' }).success).toBe(false);
  });
});
