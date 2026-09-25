import { describe, expect, it } from 'vitest';
import { polygon } from '@turf/helpers';
import { intersectGeometries, unionGeometries } from './geometry';

const a = polygon([[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]);
const b = polygon([[[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]]);
const far = polygon([[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]]);

describe('geometry combinations', () => {
  it('intersects overlapping polygons', () => expect(intersectGeometries([a, b])?.geometry.type).toBe('Polygon'));
  it('returns null for an empty intersection', () => expect(intersectGeometries([a, far])).toBeNull());
  it('unions disconnected polygons as a MultiPolygon', () => expect(unionGeometries([a, far])?.geometry.type).toBe('MultiPolygon'));
});
