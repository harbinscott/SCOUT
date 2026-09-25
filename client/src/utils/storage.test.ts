import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../../../shared/defaults';
import { loadState, saveState } from './storage';

describe('settings storage', () => {
  it('serializes and restores saved application state', () => {
    let value: string | null = null;
    const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
    const state = createDefaultState();
    state.settings.polygonOpacity = .33;
    saveState(state, storage);
    expect(loadState(storage).settings.polygonOpacity).toBe(.33);
  });
});
