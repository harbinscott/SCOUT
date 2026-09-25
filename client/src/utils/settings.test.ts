import { describe, expect, it } from 'vitest';
import { DEFAULT_BANDS } from '../../../shared/defaults';
import { validateBands } from './settings';

describe('validateBands', () => {
  it('requires strictly ordered durations', () => {
    expect(validateBands(DEFAULT_BANDS, 'DRIVE')).toBeNull();
    expect(validateBands(DEFAULT_BANDS.map((band, index) => ({ ...band, durationMinutes: index === 1 ? 10 : band.durationMinutes })), 'DRIVE')).toMatch(/ordered/);
  });
});
