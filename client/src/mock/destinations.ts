import type { Destination } from '../../../shared/types';

export const MOCK_DESTINATIONS: Destination[] = [
  { id: 'mock-downtown', placeId: 'mock-downtown', name: 'Downtown Austin', address: 'Congress Ave & 6th St, Austin, TX', latitude: 30.2672, longitude: -97.7431, primary: true },
  { id: 'mock-ut', placeId: 'mock-ut', name: 'The University of Texas at Austin', address: '110 Inner Campus Drive, Austin, TX', latitude: 30.2849, longitude: -97.7341, primary: false },
  { id: 'mock-domain', placeId: 'mock-domain', name: 'The Domain', address: '11410 Century Oaks Terrace, Austin, TX', latitude: 30.401, longitude: -97.725, primary: false },
  { id: 'mock-airport', placeId: 'mock-airport', name: 'Austin-Bergstrom Airport', address: '3600 Presidential Blvd, Austin, TX', latitude: 30.1975, longitude: -97.6664, primary: false },
  { id: 'mock-tesla', placeId: 'mock-tesla', name: 'Tesla Gigafactory Texas', address: '1 Tesla Road, Austin, TX', latitude: 30.222, longitude: -97.616, primary: false },
];
