import type { IsochroneRequest, IsochroneResult } from '../../../shared/types.js';

export interface IsochroneProvider {
  readonly name: 'google' | 'mock';
  generateIsochrone(request: IsochroneRequest, signal?: AbortSignal): Promise<IsochroneResult>;
}

export class ProviderError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 502) {
    super(message);
    this.name = 'ProviderError';
  }
}
