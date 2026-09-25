import type { Preset, SavedState } from '../../../shared/types';
import { createDefaultState } from '../../../shared/defaults';

export const STATE_KEY = 'scout_state_v1';
export const PRESETS_KEY = 'scout_presets_v1';

export function loadState(storage: Pick<Storage, 'getItem'> = localStorage): SavedState {
  try {
    const raw = storage.getItem(STATE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    const defaults = createDefaultState();
    return {
      ...defaults,
      ...parsed,
      settings: { ...defaults.settings, ...parsed.settings },
      bands: Array.isArray(parsed.bands) && parsed.bands.length === 3 ? parsed.bands : defaults.bands,
      destinations: Array.isArray(parsed.destinations) ? parsed.destinations.slice(0, 5) : [],
    };
  } catch { return createDefaultState(); }
}

export function saveState(state: SavedState, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(STATE_KEY, JSON.stringify(state));
}

export function loadPresets(storage: Pick<Storage, 'getItem'> = localStorage): Preset[] {
  try {
    const parsed = JSON.parse(storage.getItem(PRESETS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function savePresets(presets: Preset[], storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(PRESETS_KEY, JSON.stringify(presets));
}
