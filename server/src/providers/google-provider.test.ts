import { describe, expect, it } from 'vitest';
import { mapGoogleRequest, toGoogleDuration } from './google-provider.js';

describe('Google provider mapping', () => {
  it('converts minutes to a protobuf duration', () => expect(toGoogleDuration(30)).toBe('1800s'));
  it('uses the Places resource-name format', () => {
    const result = mapGoogleRequest({
      destination: { placeId: 'abc', latitude: 1, longitude: 2 }, durationMinutes: 20,
      travelMode: 'DRIVE', travelDirection: 'TO', routingPreference: 'TRAFFIC_AWARE',
      polygonFidelity: 'HIGH', enableSmoothing: true,
    });
    expect(result).toMatchObject({ place: 'places/abc', travelDuration: '1200s', travelMode: 'DRIVE' });
  });
});
