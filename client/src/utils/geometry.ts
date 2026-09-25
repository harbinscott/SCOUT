import intersect from '@turf/intersect';
import union from '@turf/union';
import area from '@turf/area';
import { feature, featureCollection } from '@turf/helpers';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { CalculationResult, CommuteBand, RenderedIsochrone } from '../../../shared/types';

type PolygonFeature = Feature<Polygon | MultiPolygon>;

export function intersectGeometries(features: PolygonFeature[]): PolygonFeature | null {
  if (!features.length) return null;
  if (features.length === 1) return features[0];
  let result: PolygonFeature | null = features[0];
  for (const next of features.slice(1)) {
    if (!result) return null;
    result = intersect(featureCollection([result, next])) as PolygonFeature | null;
  }
  return result;
}

export function unionGeometries(features: PolygonFeature[]): PolygonFeature | null {
  if (!features.length) return null;
  if (features.length === 1) return features[0];
  return union(featureCollection(features)) as PolygonFeature | null;
}

export function combineResults(results: CalculationResult[], bands: CommuteBand[], mode: 'ALL' | 'ANY' | 'INDIVIDUAL') {
  const emptyBands: string[] = [];
  if (mode === 'INDIVIDUAL') {
    return {
      features: results.map((result) => ({
        id: `${result.destinationId}-${result.bandId}`,
        feature: feature(result.geometry, { ...result }),
        bandId: result.bandId,
        bandLabel: result.bandLabel,
        durationMinutes: result.durationMinutes,
        color: result.color,
        destinationId: result.destinationId,
        destinationName: result.destinationName,
      } satisfies RenderedIsochrone)).sort((a, b) => b.durationMinutes - a.durationMinutes),
      emptyBands,
    };
  }

  const features: RenderedIsochrone[] = [];
  for (const band of bands) {
    const inputs = results.filter((result) => result.bandId === band.id).map((result) => feature(result.geometry));
    const combined = mode === 'ALL' ? intersectGeometries(inputs) : unionGeometries(inputs);
    if (!combined) {
      emptyBands.push(band.label);
      continue;
    }
    features.push({
      id: `${mode}-${band.id}`,
      feature: combined,
      bandId: band.id,
      bandLabel: band.label,
      durationMinutes: band.durationMinutes,
      color: band.color,
    });
  }
  return { features: features.sort((a, b) => b.durationMinutes - a.durationMinutes), emptyBands };
}

export function totalAreaSquareMiles(features: RenderedIsochrone[]): number {
  const squareMeters = features.reduce((sum, item) => sum + area(item.feature), 0);
  return squareMeters / 2_589_988.11;
}
