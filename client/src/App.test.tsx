import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App, { EmptyIntersectionNotice } from './App';

const polygon = { type: 'Polygon', coordinates: [[[-97.8, 30.2], [-97.6, 30.2], [-97.6, 30.4], [-97.8, 30.2]]] };

describe('SCOUT application', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/status')) return new Response(JSON.stringify({ mode: 'mock', isochronesConfigured: false, basePath: '/scout', apiVersion: 'v1-preview' }));
      return new Response(JSON.stringify({ geometry: polygon, metadata: { provider: 'mock', generatedAt: new Date().toISOString(), cacheHit: false, externalApiCalls: 0 } }));
    }));
  });

  it('adds a sample destination, edits a band, and displays generated mock results', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Downtown Austin');
    await user.click(screen.getByRole('button', { name: /Downtown Austin/ }));
    const duration = screen.getAllByRole('spinbutton')[0];
    await user.clear(duration); await user.type(duration, '18');
    await user.click(screen.getByRole('button', { name: /Generate Commute Map/ }));
    expect(await screen.findByText(/3 boundaries/)).toBeInTheDocument();
  });

  it('shows the required empty-intersection guidance', () => {
    render(<EmptyIntersectionNotice bands={['Preferred']} />);
    expect(screen.getByText(/No area meets this commute limit/)).toBeInTheDocument();
  });
});
