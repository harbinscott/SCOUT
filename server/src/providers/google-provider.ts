import type { IsochroneRequest, IsochroneResult } from '../../../shared/types.js';
import { googleResponseSchema } from '../../../shared/schemas.js';
import type { IsochroneProvider } from './provider.js';
import { ProviderError } from './provider.js';

export function toGoogleDuration(minutes: number): string { return `${minutes * 60}s`; }

export function mapGoogleRequest(request: IsochroneRequest) {
  const origin = request.destination.placeId
    ? { place: `places/${request.destination.placeId.replace(/^places\//, '')}` }
    : { location: { latitude: request.destination.latitude, longitude: request.destination.longitude } };
  return {
    ...origin,
    travelDuration: toGoogleDuration(request.durationMinutes),
    travelMode: request.travelMode,
    travelDirection: request.travelDirection,
    routingPreference: request.routingPreference,
    enableSmoothing: request.enableSmoothing,
    polygonFidelity: request.polygonFidelity,
  };
}

export class GoogleIsochroneProvider implements IsochroneProvider {
  readonly name = 'google' as const;

  constructor(private readonly apiKey: string, private readonly endpoint: string) {}

  async generateIsochrone(request: IsochroneRequest, signal?: AbortSignal): Promise<IsochroneResult> {
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.apiKey },
        body: JSON.stringify(mapGoogleRequest(request)),
        signal: signal ?? AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new ProviderError('NETWORK_ERROR', error instanceof Error && error.name === 'TimeoutError'
        ? 'Google Isochrones did not respond in time.'
        : 'Could not reach Google Isochrones.');
    }

    if (!response.ok) {
      const code = response.status === 429 ? 'QUOTA_OR_RATE_LIMIT' : response.status === 403 ? 'API_CONFIGURATION' : response.status === 404 ? 'NO_ROAD_NEAR_ORIGIN' : response.status === 400 ? 'INVALID_GOOGLE_REQUEST' : 'GOOGLE_API_ERROR';
      const message = response.status === 429
        ? 'Google rejected the request because a quota or rate limit was reached.'
        : response.status === 403
          ? 'Google rejected the server credential. Check API enablement, billing, and key restrictions.'
          : response.status === 404
            ? 'Google could not snap this destination to a supported nearby road. Try another place or travel mode.'
            : response.status === 400
              ? 'Google rejected these commute settings. Review the mode, duration, and preview API availability.'
              : 'Google could not generate this commute area.';
      throw new ProviderError(code, message, response.status === 429 ? 429 : 502);
    }

    const parsed = googleResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new ProviderError('INVALID_GEOJSON', 'Google returned an invalid or empty isochrone.');

    return {
      geometry: parsed.data.isochrone.geoJson,
      metadata: { provider: 'google', generatedAt: new Date().toISOString(), cacheHit: false, externalApiCalls: 1 },
    };
  }
}
