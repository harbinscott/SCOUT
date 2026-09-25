import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppStatus, Destination } from '../../../shared/types';
import { MOCK_DESTINATIONS } from '../mock/destinations';
import { loadGoogleMaps } from '../services/google';

interface Props {
  status: AppStatus | null;
  destinations: Destination[];
  onAdd: (destination: Destination) => void;
}

export function DestinationSearch({ status, destinations, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const liveHost = useRef<HTMLDivElement>(null);
  const isMock = status?.mode === 'mock';

  const suggestions = useMemo(() => {
    const available = MOCK_DESTINATIONS.filter((item) => !destinations.some((current) => current.id === item.id));
    if (!query.trim()) return available.slice(0, 3);
    const needle = query.toLowerCase();
    return available.filter((item) => `${item.name} ${item.address}`.toLowerCase().includes(needle));
  }, [destinations, query]);

  useEffect(() => {
    if (!status?.mapsBrowserKey || isMock || !liveHost.current) return;
    const host = liveHost.current;
    let disposed = false;
    loadGoogleMaps(status.mapsBrowserKey).then(({ places }) => {
      if (disposed) return;
      const Element = (places as unknown as { PlaceAutocompleteElement: new (options?: unknown) => HTMLElement }).PlaceAutocompleteElement;
      const autocomplete = new Element({
        locationBias: { center: { lat: 30.2672, lng: -97.7431 }, radius: 50_000 },
        requestedRegion: 'US',
      }) as HTMLElement & { placeholder: string; description: string };
      autocomplete.placeholder = 'Address or business name';
      autocomplete.description = 'Search for a commute destination';
      autocomplete.addEventListener('gmp-select', (async (event: Event) => {
        try {
          const prediction = (event as Event & { placePrediction: google.maps.places.PlacePrediction }).placePrediction;
          const predictedName = prediction.mainText?.toString() || prediction.text.toString();
          const place = prediction.toPlace();
          // Reuse the name already returned by Autocomplete. Requesting
          // displayName here would raise Place Details from Essentials to Pro.
          await place.fetchFields({ fields: ['id', 'formattedAddress', 'location'] });
          if (!place.location || !place.id) throw new Error('That result has no mappable location.');
          onAdd({
            id: crypto.randomUUID(),
            placeId: place.id,
            name: predictedName || 'Selected destination',
            address: place.formattedAddress || 'Address unavailable',
            latitude: place.location.lat(),
            longitude: place.location.lng(),
            primary: destinations.length === 0,
          });
          setError('');
        } catch (selectionError) {
          setError(selectionError instanceof Error ? selectionError.message : 'Could not add that destination.');
        }
      }) as EventListener);
      host.replaceChildren(autocomplete);
    }).catch(() => setError('Google Places could not be loaded. Check the browser key and enabled APIs.'));
    return () => { disposed = true; host.replaceChildren(); };
  }, [destinations.length, isMock, onAdd, status?.mapsBrowserKey]);

  if (!isMock) {
    return (
      <div>
        {status?.mapsBrowserKey ? <div className="place-autocomplete-host" ref={liveHost} /> : (
          <div className="config-callout">Add a browser Maps key to enable address and business search.</div>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mock-search">
      <label className="sr-only" htmlFor="mock-place-search">Search sample destinations</label>
      <input id="mock-place-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Austin samples" />
      {suggestions.length > 0 && (
        <div className="suggestions" role="listbox" aria-label="Sample destinations">
          {suggestions.slice(0, 4).map((item) => (
            <button key={item.id} type="button" onClick={() => { onAdd({ ...item, primary: destinations.length === 0 }); setQuery(''); }}>
              <span>{item.name}</span><small>{item.address}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
