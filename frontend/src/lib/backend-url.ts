/** Local Python API (uvicorn default). Used for OAuth redirects and SSR. */
export const LOCAL_BACKEND_URL = 'http://127.0.0.1:8002';

function trimUrl(url: string | undefined): string {
  return (url ?? '').trim().replace(/\/$/, '');
}

/**
 * Base URL for axios API requests.
 * - NEXT_PUBLIC_BACKEND_API_URL set → direct calls to that host
 * - Local browser / empty env → '' (relative /api/* via Next.js rewrite → BACKEND_PROXY_URL)
 * - SSR in development with empty env → LOCAL_BACKEND_URL
 * - Production must bake NEXT_PUBLIC_BACKEND_API_URL (never fall back to localhost)
 */
export function getBackendBaseUrl(): string {
  const fromEnv = trimUrl(process.env.NEXT_PUBLIC_BACKEND_API_URL);
  if (fromEnv) {
    return fromEnv;
  }

  if (typeof window !== 'undefined') {
    // Same-origin relative /api (Next rewrite in local dev, or misconfigured prod)
    return '';
  }

  if (process.env.NODE_ENV === 'development') {
    return LOCAL_BACKEND_URL;
  }

  // Static export without env would break silently on localhost — keep empty so
  // requests stay same-origin and fail loudly in network tab instead.
  return '';
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
