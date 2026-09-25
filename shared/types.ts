import type { Feature, Polygon, MultiPolygon } from 'geojson';

export type TravelMode = 'DRIVE' | 'WALK' | 'BICYCLE';
export type TravelDirection = 'TO' | 'FROM';
export type RoutingPreference = 'TRAFFIC_AWARE' | 'TRAFFIC_UNAWARE';
export type PolygonFidelity = 'LOW' | 'MEDIUM' | 'HIGH';
export type AnalysisMode = 'ALL' | 'ANY' | 'INDIVIDUAL';

export interface Destination {
  id: string;
  placeId?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  primary: boolean;
}

export interface CommuteBand {
  id: string;
  label: string;
  durationMinutes: number;
  color: string;
  visible: boolean;
}

export interface TravelSettings {
  travelMode: TravelMode;
  travelDirection: TravelDirection;
  routingPreference: RoutingPreference;
  polygonFidelity: PolygonFidelity;
  enableSmoothing: boolean;
  analysisMode: AnalysisMode;
  polygonOpacity: number;
  showTrafficLayer: boolean;
}

export interface IsochroneRequest {
  destination: Pick<Destination, 'placeId' | 'latitude' | 'longitude'>;
  durationMinutes: number;
  travelMode: TravelMode;
  travelDirection: TravelDirection;
  routingPreference: RoutingPreference;
  polygonFidelity: PolygonFidelity;
  enableSmoothing: boolean;
}

export interface IsochroneMetadata {
  provider: 'google' | 'mock';
  generatedAt: string;
  cacheHit: boolean;
  externalApiCalls: number;
}

export interface IsochroneResult {
  geometry: Polygon | MultiPolygon;
  metadata: IsochroneMetadata;
}

export interface CalculationResult extends IsochroneResult {
  destinationId: string;
  destinationName: string;
  bandId: string;
  bandLabel: string;
  durationMinutes: number;
  color: string;
  settings: TravelSettings;
}

export interface RenderedIsochrone {
  id: string;
  feature: Feature<Polygon | MultiPolygon>;
  bandId: string;
  bandLabel: string;
  durationMinutes: number;
  color: string;
  destinationId?: string;
  destinationName?: string;
}

export interface AppStatus {
  mode: 'mock' | 'live' | 'configuration-required';
  mapsBrowserKey?: string;
  isochronesConfigured: boolean;
  basePath: string;
  apiVersion: string;
  externalCallsThisHour?: number;
  externalCallLimit?: number;
  externalCallsToday?: number;
  externalCallDailyLimit?: number;
  externalCallsThisMonth?: number;
  externalCallMonthlyLimit?: number;
}

export interface SavedState {
  destinations: Destination[];
  bands: CommuteBand[];
  settings: TravelSettings;
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
}

export interface Preset {
  id: string;
  name: string;
  savedAt: string;
  state: SavedState;
}
