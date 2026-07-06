/** Local Python API (uvicorn default). Used for OAuth redirects and SSR. */
export const LOCAL_BACKEND_URL = 'http://127.0.0.1:8001';

function trimUrl(url: string | undefined): string {
  return (url ?? '').trim().replace(/\/$/, '');
}

function isLocalBrowserHost(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Base URL for axios API requests.
 * - NEXT_PUBLIC_BACKEND_API_URL set → direct calls to that host
 * - Local dev, env empty → '' (relative /api/* via Next.js rewrite → BACKEND_PROXY_URL)
 * - SSR in dev with empty env → LOCAL_BACKEND_URL
 */
export function getBackendBaseUrl(): string {
  const fromEnv = trimUrl(process.env.NEXT_PUBLIC_BACKEND_API_URL);
  if (fromEnv) {
    return fromEnv;
  }

  if (typeof window !== 'undefined' && (isLocalBrowserHost() || process.env.NODE_ENV === 'development')) {
    return '';
  }

  if (process.env.NODE_ENV === 'development') {
    return LOCAL_BACKEND_URL;
  }

  return LOCAL_BACKEND_URL;
}

/** Full API host for OAuth redirects (must hit Python directly, not the Next proxy). */
export function getBackendApiPrefix(): string {
  const fromEnv = trimUrl(process.env.NEXT_PUBLIC_BACKEND_API_URL);
  if (fromEnv) {
    return fromEnv;
  }

  const proxy = trimUrl(process.env.BACKEND_PROXY_URL);
  if (proxy) {
    return proxy;
  }

  return LOCAL_BACKEND_URL;
}
