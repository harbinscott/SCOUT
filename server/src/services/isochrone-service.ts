import type { IsochroneRequest, IsochroneResult } from '../../../shared/types.js';
import fs from 'node:fs';
import path from 'node:path';
import { createCacheKey } from '../cache/cache-key.js';
import type { CacheStore } from '../cache/memory-cache.js';
import type { IsochroneProvider } from '../providers/provider.js';
import { ProviderError } from '../providers/provider.js';

export class ExternalCallBudget {
  private calls: number[] = [];
  private month = '';
  private monthCalls = 0;
  private day = '';
  private dayCalls = 0;

  constructor(
    private readonly maximumHourly: number,
    private readonly maximumMonthly = 8000,
    private readonly maximumDaily = 200,
    private readonly usageFile?: string,
    private readonly now: () => number = Date.now,
  ) {
    this.rollPeriods();
    this.load();
  }

  private currentMonth(): string { return new Date(this.now()).toISOString().slice(0, 7); }
  private currentDay(): string { return new Date(this.now()).toISOString().slice(0, 10); }

  private rollPeriods(): void {
    const currentMonth = this.currentMonth();
    if (this.month !== currentMonth) { this.month = currentMonth; this.monthCalls = 0; }
    const currentDay = this.currentDay();
    if (this.day !== currentDay) { this.day = currentDay; this.dayCalls = 0; }
  }

  private load(): void {
    if (!this.usageFile) return;
    try {
      const stored = JSON.parse(fs.readFileSync(this.usageFile, 'utf8')) as {
        month?: string;
        calls?: number;
        day?: string;
        dailyCalls?: number;
      };
      if (stored.month === this.month && Number.isInteger(stored.calls) && Number(stored.calls) >= 0) this.monthCalls = Number(stored.calls);
      if (stored.day === this.day && Number.isInteger(stored.dailyCalls) && Number(stored.dailyCalls) >= 0) this.dayCalls = Number(stored.dailyCalls);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.monthCalls = this.maximumMonthly;
        this.dayCalls = this.maximumDaily;
        console.error('Could not read the external-call budget file; live calls are blocked until the counter is repaired.');
      }
    }
  }

  private save(): void {
    if (!this.usageFile) return;
    try {
      fs.mkdirSync(path.dirname(this.usageFile), { recursive: true });
      const temporary = `${this.usageFile}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify({
        month: this.month,
        calls: this.monthCalls,
        day: this.day,
        dailyCalls: this.dayCalls,
      }), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(temporary, this.usageFile);
    } catch {
      throw new ProviderError('BUDGET_PERSISTENCE_ERROR', 'The usage counter could not be saved, so SCOUT stopped the external call for safety.', 503);
    }
  }

  consume(): void {
    this.rollPeriods();
    const cutoff = this.now() - 3_600_000;
    this.calls = this.calls.filter((time) => time > cutoff);
    if (this.calls.length >= this.maximumHourly) {
      throw new ProviderError('HOURLY_SAFETY_LIMIT', 'The hourly external-call safety limit has been reached. Try again later or raise the configured limit.', 429);
    }
    if (this.dayCalls >= this.maximumDaily) {
      throw new ProviderError('DAILY_SAFETY_LIMIT', 'The daily external-call safety limit has been reached. Wait for the next UTC day or deliberately raise the configured limit.', 429);
    }
    if (this.monthCalls >= this.maximumMonthly) {
      throw new ProviderError('MONTHLY_SAFETY_LIMIT', 'The monthly external-call safety limit has been reached. Wait for the next calendar month or deliberately raise the configured limit.', 429);
    }
    this.calls.push(this.now());
    this.dayCalls += 1;
    this.monthCalls += 1;
    try { this.save(); }
    catch (error) {
      this.calls.pop();
      this.dayCalls -= 1;
      this.monthCalls -= 1;
      throw error;
    }
  }

  count(): number {
    const cutoff = this.now() - 3_600_000;
    this.calls = this.calls.filter((time) => time > cutoff);
    return this.calls.length;
  }

  dailyCount(): number { this.rollPeriods(); return this.dayCalls; }
  monthlyCount(): number { this.rollPeriods(); return this.monthCalls; }
}

export class IsochroneService {
  private readonly inFlight = new Map<string, Promise<IsochroneResult>>();

  constructor(
    private readonly provider: IsochroneProvider,
    private readonly cache: CacheStore<IsochroneResult>,
    private readonly trafficTtlMs: number,
    private readonly staticTtlMs: number,
    private readonly budget: ExternalCallBudget,
  ) {}

  async generate(request: IsochroneRequest, signal?: AbortSignal): Promise<IsochroneResult> {
    const key = createCacheKey(request);
    // Current Google Isochrones policy exempts Place IDs, but not completed
    // polygon responses, from general caching restrictions. Keep response
    // caching for mock/future providers and deduplicate live requests in flight.
    const mayCacheResult = this.provider.name !== 'google';
    const cached = mayCacheResult ? this.cache.get(key) : undefined;
    if (cached) return { ...cached, metadata: { ...cached.metadata, cacheHit: true, externalApiCalls: 0 } };

    const existing = this.inFlight.get(key);
    if (existing) {
      const result = await existing;
      return { ...result, metadata: { ...result.metadata, cacheHit: true, externalApiCalls: 0 } };
    }

    const promise = (async () => {
      if (this.provider.name === 'google') this.budget.consume();
      const result = await this.provider.generateIsochrone(request, signal);
      const ttl = request.routingPreference === 'TRAFFIC_AWARE' ? this.trafficTtlMs : this.staticTtlMs;
      if (mayCacheResult) this.cache.set(key, result, ttl);
      return result;
    })();

    this.inFlight.set(key, promise);
    try { return await promise; }
    finally { this.inFlight.delete(key); }
  }
}
