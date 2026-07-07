const DRIVER_AUTH_TOKEN_KEY = 'driverAuthToken';

export function getStoredDriverToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(DRIVER_AUTH_TOKEN_KEY);
}

export function setStoredDriverToken(token: string): void {
  sessionStorage.setItem(DRIVER_AUTH_TOKEN_KEY, token);
}

export function clearStoredDriverToken(): void {
  sessionStorage.removeItem(DRIVER_AUTH_TOKEN_KEY);
}
