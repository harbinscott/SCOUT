import type { MultiPolygon, Polygon, Position } from 'geojson';
import type { IsochroneRequest, IsochroneResult } from '../../../shared/types.js';
import type { IsochroneProvider } from './provider.js';

const PROFILE = [1, .82, 1.1, .73, 1.18, .92, 1.04, .7, 1.15, .88, 1.2, .76, 1.08, .84, 1.12, .71, 1.19, .9, 1.03, .75, 1.13, .86, 1.06, .8];

function ring(center: [number, number], latRadius: number, lngRadius: number, direction: 'TO' | 'FROM'): Position[] {
  const points = PROFILE.map((factor, index) => {
    const angle = ((index / PROFILE.length) * Math.PI * 2) - Math.PI / 2;
    const directional = direction === 'TO' ? 1 + Math.sin(angle * 3) * .07 : 1 + Math.cos(angle * 2) * .06;
    return [
      center[0] + Math.cos(angle) * lngRadius * factor * directional,
      center[1] + Math.sin(angle) * latRadius * factor * directional,
    ];
  });
  points.push([...points[0]]);
  return points;
}

export function createMockGeometry(request: IsochroneRequest): Polygon | MultiPolygon {
  const modeScale = request.travelMode === 'DRIVE' ? 1 : request.travelMode === 'BICYCLE' ? .32 : .14;
  const fidelityScale = request.polygonFidelity === 'LOW' ? .96 : request.polygonFidelity === 'HIGH' ? 1.02 : 1;
  const scale = request.durationMinutes * .0072 * modeScale * fidelityScale;
  const center: [number, number] = [request.destination.longitude, request.destination.latitude];
  const main = ring(center, scale, scale * 1.22, request.travelDirection);

  if (request.durationMinutes >= 45 && request.travelMode === 'DRIVE') {
    const islandCenter: [number, number] = [center[0] + scale * 1.3, center[1] - scale * .32];
    const island = ring(islandCenter, scale * .14, scale * .18, request.travelDirection);
    return { type: 'MultiPolygon', coordinates: [[main], [island]] };
  }
  return { type: 'Polygon', coordinates: [main] };
}

export class MockIsochroneProvider implements IsochroneProvider {
  readonly name = 'mock' as const;

  async generateIsochrone(request: IsochroneRequest): Promise<IsochroneResult> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return {
      geometry: createMockGeometry(request),
      metadata: { provider: 'mock', generatedAt: new Date().toISOString(), cacheHit: false, externalApiCalls: 0 },
    };
  }
}
