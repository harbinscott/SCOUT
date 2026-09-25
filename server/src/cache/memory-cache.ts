export interface CacheEntry<T> { value: T; expiresAt: number }

export interface CacheStore<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, ttlMs: number): void;
  clear(): void;
}

export class MemoryCache<T> implements CacheStore<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly now: () => number = Date.now) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  clear(): void { this.entries.clear(); }
}
