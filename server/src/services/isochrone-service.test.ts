import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryCache } from '../cache/memory-cache.js';
import { ExternalCallBudget, IsochroneService } from './isochrone-service.js';
import type { IsochroneProvider } from '../providers/provider.js';

const request = {
  destination: { latitude: 30, longitude: -97 }, durationMinutes: 20,
  travelMode: 'DRIVE' as const, travelDirection: 'TO' as const, routingPreference: 'TRAFFIC_UNAWARE' as const,
  polygonFidelity: 'MEDIUM' as const, enableSmoothing: true,
};

describe('IsochroneService', () => {
  it('deduplicates identical in-flight calls and then caches', async () => {
    const generateIsochrone = vi.fn(async () => ({
      geometry: { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] },
      metadata: { provider: 'mock' as const, generatedAt: '', cacheHit: false, externalApiCalls: 0 },
    }));
    const provider: IsochroneProvider = { name: 'mock', generateIsochrone };
    const service = new IsochroneService(provider, new MemoryCache(), 1000, 1000, new ExternalCallBudget(5));
    await Promise.all([service.generate(request), service.generate(request)]);
    await service.generate(request);
    expect(generateIsochrone).toHaveBeenCalledTimes(1);
  });

  it('does not cache completed Google geometry under the current policy', async () => {
    const generateIsochrone = vi.fn(async () => ({
      geometry: { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] },
      metadata: { provider: 'google' as const, generatedAt: '', cacheHit: false, externalApiCalls: 1 },
    }));
    const provider: IsochroneProvider = { name: 'google', generateIsochrone };
    const service = new IsochroneService(provider, new MemoryCache(), 1000, 1000, new ExternalCallBudget(5));
    await service.generate(request);
    await service.generate(request);
    expect(generateIsochrone).toHaveBeenCalledTimes(2);
  });

  it('stops external calls before the monthly safety allowance is exhausted', () => {
    const budget = new ExternalCallBudget(10, 2, 10);
    budget.consume();
    budget.consume();
    expect(() => budget.consume()).toThrow(/monthly external-call safety limit/i);
  });

  it('stops a burst at the durable daily safety limit', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-budget-'));
    const usageFile = path.join(directory, 'usage.json');
    try {
      const firstProcess = new ExternalCallBudget(10, 10, 2, usageFile);
      firstProcess.consume();
      firstProcess.consume();
      const restartedProcess = new ExternalCallBudget(10, 10, 2, usageFile);
      expect(() => restartedProcess.consume()).toThrow(/daily external-call safety limit/i);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
