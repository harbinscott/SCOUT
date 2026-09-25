import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppStatus, CalculationResult, CommuteBand, Destination, Preset, SavedState, TravelMode, TravelSettings } from '../../shared/types';
import { createDefaultState } from '../../shared/defaults';
import { DestinationSearch } from './components/DestinationSearch';
import { MapView } from './components/MapView';
import { PresetManager } from './components/PresetManager';
import { generateIsochrone, getStatus } from './services/api';
import { combineResults, totalAreaSquareMiles } from './utils/geometry';
import { validateBands } from './utils/settings';
import { loadPresets, loadState, savePresets, saveState } from './utils/storage';

interface Summary {
  generatedAt: string;
  cached: number;
  externalCalls: number;
  failures: string[];
}

const MODE_LABELS = { ALL: 'All destinations', ANY: 'Any destination', INDIVIDUAL: 'Individual' } as const;

export function EmptyIntersectionNotice({ bands }: { bands: string[] }) {
  if (!bands.length) return null;
  return (
    <div className="empty-notice" role="status">
      <b>No shared area for {bands.join(', ')}</b>
      <span>No area meets this commute limit for every selected destination. Increase the commute time or switch to Individual view.</span>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<SavedState>(() => loadState());
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ complete: 0, total: 0 });
  const [sessionCalls, setSessionCalls] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { getStatus().then(setStatus).catch((error) => setStatusError(error.message)); }, []);
  useEffect(() => saveState(state), [state]);
  useEffect(() => savePresets(presets), [presets]);

  const inputFingerprint = JSON.stringify({ destinations: state.destinations, bands: state.bands, settings: state.settings });
  useEffect(() => {
    if (loading && abortRef.current) {
      abortRef.current.abort();
      setLoading(false);
      setErrors(['The pending calculation was cancelled because its settings changed. Select Generate when ready.']);
    }
    // Only changes to the fingerprint should invalidate a running request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputFingerprint]);

  const setSettings = (patch: Partial<TravelSettings>) => setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  const bandError = validateBands(state.bands, state.settings.travelMode);
  const visibleBands = useMemo(() => new Set(state.bands.filter((band) => band.visible).map((band) => band.id)), [state.bands]);
  const combined = useMemo(() => combineResults(results, state.bands, state.settings.analysisMode), [results, state.bands, state.settings.analysisMode]);
  const resultArea = useMemo(() => totalAreaSquareMiles(combined.features), [combined.features]);

  const addDestination = useCallback((destination: Destination) => {
    setState((current) => {
      if (current.destinations.length >= 5 || current.destinations.some((item) => item.placeId && item.placeId === destination.placeId)) return current;
      return { ...current, destinations: [...current.destinations, { ...destination, primary: current.destinations.length === 0 || destination.primary }] };
    });
  }, []);

  const removeDestination = (id: string) => setState((current) => {
    const wasPrimary = current.destinations.find((item) => item.id === id)?.primary;
    const destinations = current.destinations.filter((item) => item.id !== id);
    if (wasPrimary && destinations[0]) destinations[0] = { ...destinations[0], primary: true };
    return { ...current, destinations };
  });

  const updateBand = (id: string, patch: Partial<CommuteBand>) => setState((current) => ({
    ...current, bands: current.bands.map((band) => band.id === id ? { ...band, ...patch } : band),
  }));

  const setTravelMode = (travelMode: TravelMode) => setSettings({
    travelMode,
    routingPreference: travelMode === 'DRIVE' ? state.settings.routingPreference : 'TRAFFIC_UNAWARE',
    showTrafficLayer: travelMode === 'DRIVE' ? state.settings.showTrafficLayer : false,
  });

  const generate = async () => {
    setErrors([]);
    if (!state.destinations.length) { setErrors(['Add at least one destination first.']); return; }
    if (bandError) { setErrors([bandError]); return; }
    if (!status || status.mode === 'configuration-required') { setErrors(['Google Isochrones is not configured. Enable mock mode or add the server credential.']); return; }

    const total = state.destinations.length * state.bands.length;
    if (total > 15 && !window.confirm(`This may make ${total} uncached external calls. Continue?`)) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setProgress({ complete: 0, total });

    const failures: string[] = [];
    const completed: CalculationResult[] = [];
    await Promise.all(state.destinations.flatMap((destination) => state.bands.map(async (band) => {
      try {
        const response = await generateIsochrone({
          destination: { placeId: destination.placeId, latitude: destination.latitude, longitude: destination.longitude },
          durationMinutes: band.durationMinutes,
          travelMode: state.settings.travelMode,
          travelDirection: state.settings.travelDirection,
          routingPreference: state.settings.routingPreference,
          polygonFidelity: state.settings.polygonFidelity,
          enableSmoothing: state.settings.enableSmoothing,
        }, controller.signal);
        completed.push({ ...response, destinationId: destination.id, destinationName: destination.name, bandId: band.id, bandLabel: band.label, durationMinutes: band.durationMinutes, color: band.color, settings: { ...state.settings } });
      } catch (error) {
        if (!controller.signal.aborted) failures.push(`${destination.name} · ${band.label}: ${error instanceof Error ? error.message : 'Request failed'}`);
      } finally {
        setProgress((current) => ({ ...current, complete: current.complete + 1 }));
      }
    })));

    if (controller.signal.aborted) return;
    const externalCalls = completed.reduce((sum, item) => sum + item.metadata.externalApiCalls, 0);
    const cached = completed.filter((item) => item.metadata.cacheHit).length;
    setResults(completed);
    setSummary({ generatedAt: new Date().toISOString(), cached, externalCalls, failures });
    setSessionCalls((count) => count + externalCalls);
    void getStatus().then(setStatus).catch(() => undefined);
    setErrors(failures);
    setLoading(false);
  };

  const reset = () => {
    abortRef.current?.abort();
    setState(createDefaultState());
    setResults([]); setSummary(null); setErrors([]); setLoading(false);
  };

  const statusPresentation = statusError
    ? { label: 'API Error', className: 'status--error' }
    : !status ? { label: 'Connecting', className: 'status--pending' }
      : status.mode === 'mock' ? { label: 'Mock Mode', className: 'status--mock' }
        : status.mode === 'live' ? { label: 'Connected', className: 'status--live' }
          : { label: 'Configuration Required', className: 'status--error' };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span>S</span></div>
        <div className="brand-copy"><div><b>SCOUT</b><span>Simple Commute Opportunity Utility Tool</span></div><p>Explore where your commute can take you.</p></div>
        <div className="header-actions">
          <span className={`api-status ${statusPresentation.className}`}><i />{statusPresentation.label}</span>
          <span className="session-counter" title={`${sessionCalls} external calls made by this browser session`}>
            Calls <b>{status?.externalCallsToday ?? 0}/{status?.externalCallDailyLimit ?? 200} day · {status?.externalCallsThisMonth ?? 0}/{(status?.externalCallMonthlyLimit ?? 8000).toLocaleString()} month</b>
          </span>
          <button className="icon-button" type="button" onClick={reset} title="Reset to defaults" aria-label="Reset to defaults">↻</button>
          <button className="mobile-panel-toggle" type="button" onClick={() => setPanelOpen((value) => !value)} aria-expanded={panelOpen}>Controls</button>
        </div>
      </header>

      <main className="main-layout">
        <aside className={`control-panel ${panelOpen ? 'control-panel--open' : ''}`} aria-label="Commute controls">
          <div className="panel-scroll">
            <section className="control-section destinations-section">
              <div className="section-heading"><span className="step-number">1</span><div><h2>Destinations</h2><p>Where do you need to be?</p></div><span className="count-pill">{state.destinations.length}/5</span></div>
              <DestinationSearch status={status} destinations={state.destinations} onAdd={addDestination} />
              <div className="destination-list">
                {state.destinations.map((item, index) => (
                  <article className="destination-card" key={item.id}>
                    <span className="destination-number">{index + 1}</span>
                    <div><b>{item.name}</b><span>{item.address}</span><button type="button" className={item.primary ? 'primary-tag active' : 'primary-tag'} onClick={() => setState((current) => ({ ...current, destinations: current.destinations.map((destination) => ({ ...destination, primary: destination.id === item.id })) }))}>{item.primary ? 'Primary' : 'Make primary'}</button></div>
                    <button className="remove-button" type="button" onClick={() => removeDestination(item.id)} aria-label={`Remove ${item.name}`}>×</button>
                  </article>
                ))}
              </div>
            </section>

            <section className="control-section">
              <div className="section-heading"><span className="step-number">2</span><div><h2>Commute bands</h2><p>Your three travel-time tolerances</p></div></div>
              <div className="bands-editor">
                {state.bands.map((band) => (
                  <div className="band-row" key={band.id}>
                    <span className="band-swatch" style={{ backgroundColor: band.color }} />
                    <label><span className="sr-only">Band label</span><input value={band.label} maxLength={24} onChange={(event) => updateBand(band.id, { label: event.target.value })} /></label>
                    <label className="minutes-input"><span className="sr-only">Minutes</span><input type="number" min="1" max={state.settings.travelMode === 'DRIVE' ? 60 : 120} value={band.durationMinutes} onChange={(event) => updateBand(band.id, { durationMinutes: Number(event.target.value) })} /><span>min</span></label>
                  </div>
                ))}
              </div>
              {bandError && <p className="field-error" role="alert">{bandError}</p>}
              <div className="traffic-note" title="Traffic information"><b>i</b><span>Commute bands are thresholds. Current Traffic uses live conditions; it is not a historical average or future forecast.</span></div>
            </section>

            <section className="control-section">
              <div className="section-heading"><span className="step-number">3</span><div><h2>Travel settings</h2><p>Shape the route calculation</p></div></div>
              <fieldset><legend>Travel mode</legend><div className="segmented segmented--three">
                {(['DRIVE', 'WALK', 'BICYCLE'] as const).map((mode) => <button type="button" className={state.settings.travelMode === mode ? 'selected' : ''} key={mode} onClick={() => setTravelMode(mode)}>{mode === 'DRIVE' ? 'Drive' : mode === 'WALK' ? 'Walk' : 'Bike'}</button>)}
              </div></fieldset>
              <fieldset><legend>Travel direction</legend><div className="direction-options">
                <label className={state.settings.travelDirection === 'TO' ? 'choice-card selected' : 'choice-card'}><input type="radio" name="direction" checked={state.settings.travelDirection === 'TO'} onChange={() => setSettings({ travelDirection: 'TO' })} /><span><b>To destination</b><small>Where could I live and still reach it in time?</small></span></label>
                <label className={state.settings.travelDirection === 'FROM' ? 'choice-card selected' : 'choice-card'}><input type="radio" name="direction" checked={state.settings.travelDirection === 'FROM'} onChange={() => setSettings({ travelDirection: 'FROM' })} /><span><b>From destination</b><small>Where could I reach when leaving here?</small></span></label>
              </div></fieldset>
              <div className="two-column-fields">
                <label><span>Routing</span><select value={state.settings.routingPreference} disabled={state.settings.travelMode !== 'DRIVE'} onChange={(event) => setSettings({ routingPreference: event.target.value as TravelSettings['routingPreference'] })}><option value="TRAFFIC_AWARE">Current traffic</option><option value="TRAFFIC_UNAWARE">Ignore traffic</option></select></label>
                <label><span>Polygon detail</span><select value={state.settings.polygonFidelity} onChange={(event) => setSettings({ polygonFidelity: event.target.value as TravelSettings['polygonFidelity'] })}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
              </div>
              <label className="toggle-row"><span><b>Smooth polygon edges</b><small>Round grid artifacts for easier viewing</small></span><input type="checkbox" checked={state.settings.enableSmoothing} onChange={(event) => setSettings({ enableSmoothing: event.target.checked })} /></label>
            </section>

            <section className="control-section">
              <div className="section-heading"><span className="step-number">4</span><div><h2>Multiple destinations</h2><p>How should areas combine?</p></div></div>
              <div className="analysis-options">
                {(['ALL', 'ANY', 'INDIVIDUAL'] as const).map((mode) => <button type="button" key={mode} className={state.settings.analysisMode === mode ? 'selected' : ''} onClick={() => setSettings({ analysisMode: mode })}><b>{MODE_LABELS[mode]}</b><span>{mode === 'ALL' ? 'Shared overlap only' : mode === 'ANY' ? 'Combined reach' : 'Separate boundaries'}</span></button>)}
              </div>
            </section>

            <section className="control-section preset-section">
              <PresetManager presets={presets} state={state} onChange={setPresets} onLoad={(next) => { setState(next); setResults([]); setSummary(null); }} />
            </section>
          </div>

          <div className="generate-dock">
            <div className="call-estimate"><span>Estimated requests</span><b>{state.destinations.length * 3}</b><small>before cache reuse</small></div>
            <button className="generate-button" type="button" disabled={loading} onClick={generate}>{loading ? `Generating ${progress.complete}/${progress.total}…` : 'Generate Commute Map'}<span aria-hidden="true">→</span></button>
            {loading && <button className="cancel-link" type="button" onClick={() => { abortRef.current?.abort(); setLoading(false); }}>Cancel calculation</button>}
          </div>
        </aside>

        <section className="map-workspace" aria-label="Commute map">
          <MapView status={status} destinations={state.destinations} features={combined.features} settings={state.settings} visibleBands={visibleBands} center={state.mapCenter} zoom={state.mapZoom} onViewChange={(mapCenter, mapZoom) => setState((current) => ({ ...current, mapCenter, mapZoom }))} />

          <div className="map-topline">
            <span>{MODE_LABELS[state.settings.analysisMode]}</span><i />
            <span>{state.settings.travelDirection === 'TO' ? 'Traveling to' : 'Traveling from'}</span><i />
            <span>{state.settings.routingPreference === 'TRAFFIC_AWARE' ? 'Live traffic' : 'Traffic unaware'}</span>
          </div>

          <div className="map-legend">
            <div className="legend-heading"><b>Commute bands</b><span>{Math.round(state.settings.polygonOpacity * 100)}% fill</span></div>
            {state.bands.map((band, index) => <label key={band.id} className={band.visible ? '' : 'muted'}><input type="checkbox" checked={band.visible} onChange={(event) => updateBand(band.id, { visible: event.target.checked })} /><i style={{ backgroundColor: band.color, borderWidth: `${Math.max(1, 3 - index * .7)}px` }} /><span><b>{band.label}</b><small>{band.durationMinutes} min</small></span></label>)}
            <label className="opacity-control"><span>Polygon opacity</span><input type="range" min="0.08" max="0.5" step="0.01" value={state.settings.polygonOpacity} onChange={(event) => setSettings({ polygonOpacity: Number(event.target.value) })} /></label>
            <label className="traffic-layer-toggle"><input type="checkbox" disabled={state.settings.travelMode !== 'DRIVE' || !status?.mapsBrowserKey} checked={state.settings.showTrafficLayer} onChange={(event) => setSettings({ showTrafficLayer: event.target.checked })} /><span>Show traffic overlay</span></label>
          </div>

          {!results.length && !loading && <div className="map-empty-state"><span className="route-glyph">⌁</span><b>Your commute map starts here</b><p>Add a destination, tune your commute bands, then generate the map.</p></div>}
          {loading && <div className="loading-card"><span className="loading-orbit" /><div><b>Tracing the road network</b><p>{progress.complete} of {progress.total} boundaries complete</p><progress value={progress.complete} max={progress.total} /></div></div>}
          {state.settings.analysisMode === 'ALL' && <EmptyIntersectionNotice bands={combined.emptyBands} />}
          {errors.length > 0 && <div className="error-stack" role="alert">{errors.slice(0, 3).map((error) => <span key={error}>{error}</span>)}</div>}

          {summary && results.length > 0 && (
            <div className="result-summary">
              <div><span className="summary-kicker">Latest calculation</span><b>{state.destinations.length} destination{state.destinations.length === 1 ? '' : 's'} · {results.length} boundaries</b><small>{new Date(summary.generatedAt).toLocaleString()}</small></div>
              <dl><div><dt>Area shown</dt><dd>{resultArea.toLocaleString(undefined, { maximumFractionDigits: 1 })} mi²</dd></div><div><dt>Cache reuse</dt><dd>{summary.cached}/{results.length}</dd></div><div><dt>External calls</dt><dd>{summary.externalCalls}</dd></div><div><dt>Mode</dt><dd>{MODE_LABELS[state.settings.analysisMode]}</dd></div></dl>
              <button type="button" onClick={() => setSummary(null)} aria-label="Dismiss result summary">×</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
