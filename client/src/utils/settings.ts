import type { CommuteBand, TravelMode } from '../../../shared/types';

export function validateBands(bands: CommuteBand[], travelMode: TravelMode): string | null {
  const maximum = travelMode === 'DRIVE' ? 60 : 120;
  if (bands.some((band) => !Number.isInteger(band.durationMinutes) || band.durationMinutes <= 0)) {
    return 'Every commute duration must be a positive whole number.';
  }
  if (bands.some((band) => band.durationMinutes > maximum)) {
    return `${travelMode === 'DRIVE' ? 'Driving' : 'Walking and bicycling'} durations cannot exceed ${maximum} minutes.`;
  }
  if (!(bands[0].durationMinutes < bands[1].durationMinutes && bands[1].durationMinutes < bands[2].durationMinutes)) {
    return 'Commute durations must be ordered from shortest to longest.';
  }
  if (bands.some((band) => !band.label.trim())) return 'Every commute band needs a label.';
  return null;
}
