import { WeatherData } from '../types';

/**
 * Weather Service
 * Securely proxies weather queries to the backend.
 * Respects user location permissions and supports manual city overrides.
 */

export async function fetchWeather(params?: {
  city?: string;
  coords?: { lat: number; lng: number };
}): Promise<WeatherData> {
  const queryParams = new URLSearchParams();
  if (params?.coords) {
    queryParams.set('lat', params.coords.lat.toString());
    queryParams.set('lng', params.coords.lng.toString());
  } else if (params?.city) {
    queryParams.set('city', params.city);
  }

  const url = `/api/weather${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather fetch failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Explicitly request browser geolocation if permission is granted.
 * Does not silently invoke geolocation without explicit user gesture.
 */
export async function requestBrowserLocation(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Permission denied or unavailable - graceful resolution
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 10 * 60 * 1000, // 10 minutes cache
      }
    );
  });
}
