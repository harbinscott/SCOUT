import { z } from 'zod';

const finite = z.number().finite();

export const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.array(finite).length(2))).min(1),
});

export const multiPolygonSchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(z.array(z.array(finite).length(2))).min(1)).min(1),
});

export const geometrySchema = z.union([polygonSchema, multiPolygonSchema]);

export const isochroneRequestSchema = z.object({
  destination: z.object({
    placeId: z.string().trim().min(1).max(256).optional(),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
  durationMinutes: z.number().int().positive().max(120),
  travelMode: z.enum(['DRIVE', 'WALK', 'BICYCLE']),
  travelDirection: z.enum(['TO', 'FROM']),
  routingPreference: z.enum(['TRAFFIC_AWARE', 'TRAFFIC_UNAWARE']),
  polygonFidelity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  enableSmoothing: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.travelMode === 'DRIVE' && value.durationMinutes > 60) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['durationMinutes'], message: 'Driving is limited to 60 minutes.' });
  }
  if (value.travelMode !== 'DRIVE' && value.routingPreference === 'TRAFFIC_AWARE') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['routingPreference'], message: 'Live traffic is available only for driving.' });
  }
});

export const googleResponseSchema = z.object({
  isochrone: z.object({
    geoJson: geometrySchema,
  }),
});
