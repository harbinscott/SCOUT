import { useEffect, useMemo, useRef, useState } from 'react';
import bbox from '@turf/bbox';
import { featureCollection } from '@turf/helpers';
import type { Feature, Geometry, MultiPolygon, Polygon, Position } from 'geojson';
import type { AppStatus, Destination, RenderedIsochrone, TravelSettings } from '../../../shared/types';
import { AUSTIN_CENTER } from '../../../shared/defaults';
import { loadGoogleMaps } from '../services/google';

interface Props {
  status: AppStatus | null;
  destinations: Destination[];
  features: RenderedIsochrone[];
  settings: TravelSettings;
  visibleBands: Set<string>;
  center: { lat: number; lng: number };
  zoom: number;
  onViewChange: (center: { lat: number; lng: number }, zoom: number) => void;
}

function geometryRings(geometry: Polygon | MultiPolygon): Position[][] {
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
}

function MockMap({ destinations, features, settings, visibleBands }: Omit<Props, 'status' | 'center' | 'zoom' | 'onViewChange'>) {
  const visible = features.filter((item) => visibleBands.has(item.bandId));
  const bounds = useMemo(() => {
    if (!visible.length && !destinations.length) return [-98.2, 29.85, -97.3, 30.65] as [number, number, number, number];
    const featureBounds = visible.length ? bbox(featureCollection(visible.map((item) => item.feature))) : null;
    const lngs = destinations.map((item) => item.longitude);
    const lats = destinations.map((item) => item.latitude);
    const raw = featureBounds || [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
    const xPad = Math.max((raw[2] - raw[0]) * .12, .08);
    const yPad = Math.max((raw[3] - raw[1]) * .12, .06);
    return [raw[0] - xPad, raw[1] - yPad, raw[2] + xPad, raw[3] + yPad] as [number, number, number, number];
  }, [destinations, visible]);
  const project = (position: Position) => [
    ((position[0] - bounds[0]) / (bounds[2] - bounds[0])) * 1000,
    640 - ((position[1] - bounds[1]) / (bounds[3] - bounds[1])) * 640,
  ];
  const pathFor = (geometry: Polygon | MultiPolygon) => geometryRings(geometry).map((ring) => ring.map((position, index) => {
    const [x, y] = project(position);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z').join(' ');

  return (
    <div className="mock-map" role="img" aria-label="Mock Austin map with commute isochrones">
      <div className="mock-map-grid" />
      <span className="city-label city-label--austin">AUSTIN</span>
      <span className="city-label city-label--roundrock">ROUND ROCK</span>
      <span className="water-label">Lady Bird Lake</span>
      <svg viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true">
        <path className="river" d="M-20 415 C160 390, 260 455, 430 420 S720 390, 1020 430" />
        <path className="highway highway--one" d="M510 -20 C480 130, 530 260, 500 680" />
        <path className="highway highway--two" d="M-30 350 C220 330, 340 290, 1020 270" />
        {visible.map((item, index) => (
          <path
            key={item.id}
            d={pathFor(item.feature.geometry)}
            fill={item.color}
            fillOpacity={settings.polygonOpacity}
            stroke={item.color}
            strokeWidth={Math.max(2, 5 - index * .55)}
            strokeDasharray={item.destinationId ? `${9 + (index % 3) * 3} 5` : undefined}
            fillRule="evenodd"
            className="isochrone-shape"
          />
        ))}
      </svg>
      {destinations.map((item, index) => {
        const [x, y] = project([item.longitude, item.latitude]);
        return <span key={item.id} className="map-pin" style={{ left: `${x / 10}%`, top: `${y / 6.4}%` }} title={item.name}>{index + 1}</span>;
      })}
      <div className="mock-watermark"><span>SIMULATED MAP</span><small>Local Austin fixture · no Google calls</small></div>
    </div>
  );
}

function GoogleMap({ status, destinations, features, settings, visibleBands, center, zoom, onViewChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const markerConstructor = useRef<typeof google.maps.Marker | null>(null);
  const knownDestinationIds = useRef<Set<string>>(new Set());
  const traffic = useRef<google.maps.TrafficLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [selected, setSelected] = useState<{ label: string; detail: string } | null>(null);

  useEffect(() => {
    if (!status?.mapsBrowserKey || !host.current || mapRef.current) return;
    loadGoogleMaps(status.mapsBrowserKey).then(({ marker }) => {
      if (!host.current) return;
      markerConstructor.current = marker.Marker;
      const map = new google.maps.Map(host.current, {
        center, zoom, fullscreenControl: true, mapTypeControl: false, streetViewControl: false,
        styles: [
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e7e4dc' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#b9d9d5' }] },
        ],
      });
      map.addListener('idle', () => {
        const nextCenter = map.getCenter();
        if (nextCenter) onViewChange({ lat: nextCenter.lat(), lng: nextCenter.lng() }, map.getZoom() || zoom);
      });
      map.data.addListener('click', (event: google.maps.Data.MouseEvent) => setSelected({
        label: String(event.feature.getProperty('bandLabel') || 'Commute area'),
        detail: String(event.feature.getProperty('detail') || ''),
      }));
      mapRef.current = map;
      traffic.current = new google.maps.TrafficLayer();
      setMapReady(true);
    }).catch(() => setMapError('Google Maps could not load. Check the browser key, referrer restrictions, and certificate trust.'));
  }, [center, onViewChange, status?.mapsBrowserKey, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.data.forEach((item) => map.data.remove(item));
    features.filter((item) => visibleBands.has(item.bandId)).forEach((item) => map.data.addGeoJson({
      type: 'Feature', geometry: item.feature.geometry,
      properties: { color: item.color, bandLabel: item.bandLabel, durationMinutes: item.durationMinutes, detail: `${item.durationMinutes} min · ${item.destinationName || 'combined result'}` },
    }));
    map.data.setStyle((feature) => ({
      fillColor: String(feature.getProperty('color')), fillOpacity: settings.polygonOpacity,
      strokeColor: String(feature.getProperty('color')), strokeOpacity: .95,
      strokeWeight: Number(feature.getProperty('durationMinutes')) <= 20 ? 4 : 2.5,
      zIndex: 120 - Number(feature.getProperty('durationMinutes')),
    }));
  }, [features, mapReady, settings.polygonOpacity, visibleBands]);

  useEffect(() => {
    const map = mapRef.current;
    const Marker = markerConstructor.current;
    if (!map || !Marker) return;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current = destinations.map((item, index) => new Marker({
      map, position: { lat: item.latitude, lng: item.longitude }, label: { text: String(index + 1), color: 'white', fontWeight: '700' }, title: item.name,
    }));

    const newlyAdded = destinations.filter((item) => !knownDestinationIds.current.has(item.id));
    const destinationToFocus = newlyAdded.find((item) => item.primary) || newlyAdded.at(-1);
    knownDestinationIds.current = new Set(destinations.map((item) => item.id));
    if (destinationToFocus) {
      map.panTo({ lat: destinationToFocus.latitude, lng: destinationToFocus.longitude });
      if ((map.getZoom() || zoom) < 13) map.setZoom(13);
    }
  }, [destinations, mapReady, zoom]);

  useEffect(() => { traffic.current?.setMap(settings.showTrafficLayer ? mapRef.current : null); }, [mapReady, settings.showTrafficLayer]);

  const fit = () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    let hasPoint = false;
    map.data.forEach((item) => item.getGeometry()?.forEachLatLng((point) => { bounds.extend(point); hasPoint = true; }));
    destinations.forEach((item) => { bounds.extend({ lat: item.latitude, lng: item.longitude }); hasPoint = true; });
    if (hasPoint) map.fitBounds(bounds, 36);
  };

  return (
    <div className="google-map-shell">
      <div className="google-map" ref={host} />
      {mapError && <div className="map-error">{mapError}</div>}
      <div className="map-toolbox"><button type="button" onClick={fit}>Fit results</button><button type="button" onClick={() => { mapRef.current?.setCenter(AUSTIN_CENTER); mapRef.current?.setZoom(10); }}>Austin</button></div>
      {selected && <button type="button" className="polygon-popover" onClick={() => setSelected(null)}><b>{selected.label}</b><span>{selected.detail}</span><small>Click to close</small></button>}
    </div>
  );
}

export function MapView(props: Props) {
  if (props.status?.mode === 'mock' || !props.status?.mapsBrowserKey) {
    return <MockMap destinations={props.destinations} features={props.features} settings={props.settings} visibleBands={props.visibleBands} />;
  }
  return <GoogleMap {...props} />;
}
