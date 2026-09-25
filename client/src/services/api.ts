import type { AppStatus, IsochroneRequest, IsochroneResult } from '../../../shared/types';

const apiUrl = (path: string) => `${import.meta.env.BASE_URL}api/${path}`;

export async function getStatus(): Promise<AppStatus> {
  const response = await fetch(apiUrl('status'));
  if (!response.ok) throw new Error('Could not reach the local SCOUT service.');
  return response.json();
}

export async function generateIsochrone(request: IsochroneRequest, signal: AbortSignal): Promise<IsochroneResult> {
  const response = await fetch(apiUrl('isochrones'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || 'The commute area could not be generated.');
  return payload;
}
