import type { CommuteBand, SavedState, TravelSettings } from './types.js';

export const AUSTIN_CENTER = { lat: 30.2672, lng: -97.7431 };

export const DEFAULT_BANDS: CommuteBand[] = [
  { id: 'preferred', label: 'Preferred', durationMinutes: 20, color: '#18845c', visible: true },
  { id: 'target', label: 'Target', durationMinutes: 30, color: '#246bce', visible: true },
  { id: 'maximum', label: 'Maximum', durationMinutes: 45, color: '#e0772f', visible: true },
];

export const DEFAULT_SETTINGS: TravelSettings = {
  travelMode: 'DRIVE',
  travelDirection: 'TO',
  routingPreference: 'TRAFFIC_AWARE',
  polygonFidelity: 'MEDIUM',
  enableSmoothing: true,
  analysisMode: 'ALL',
  polygonOpacity: 0.2,
  showTrafficLayer: false,
};

export function createDefaultState(): SavedState {
  return {
    destinations: [],
    bands: DEFAULT_BANDS.map((band) => ({ ...band })),
    settings: { ...DEFAULT_SETTINGS },
    mapCenter: { ...AUSTIN_CENTER },
    mapZoom: 10,
  };
}
