import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let configuredKey = '';

export async function loadGoogleMaps(key: string) {
  if (!configuredKey) {
    configuredKey = key;
    setOptions({ key, v: 'weekly', authReferrerPolicy: 'origin' });
  }
  if (configuredKey !== key) throw new Error('Google Maps was initialized with a different browser credential.');
  const [maps, places, marker] = await Promise.all([
    importLibrary('maps'),
    importLibrary('places'),
    importLibrary('marker'),
  ]);
  return { maps, places, marker };
}
