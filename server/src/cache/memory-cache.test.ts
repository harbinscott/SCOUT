import { describe, expect, it } from 'vitest';
import { MemoryCache } from './memory-cache.js';

describe('MemoryCache', () => {
  it('returns values before expiration and evicts them afterward', () => {
    let now = 100;
    const cache = new MemoryCache<string>(() => now);
    cache.set('a', 'value', 50);
    expect(cache.get('a')).toBe('value');
    now = 151;
    expect(cache.get('a')).toBeUndefined();
  });
});
