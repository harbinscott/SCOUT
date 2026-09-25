import type { IsochroneRequest } from '../../../shared/types.js';

const coordinate = (value: number) => value.toFixed(6);

export function createCacheKey(request: IsochroneRequest, apiVersion = 'v1'): string {
  const origin = request.destination.placeId
    ? `place:${request.destination.placeId}`
    : `coords:${coordinate(request.destination.latitude)},${coordinate(request.destination.longitude)}`;
  return [
    apiVersion,
    origin,
    `${request.durationMinutes * 60}s`,
    request.travelMode,
    request.travelDirection,
    request.routingPreference,
    request.enableSmoothing ? 'smooth' : 'raw',
    request.polygonFidelity,
  ].join('|');
}
