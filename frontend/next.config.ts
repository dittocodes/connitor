import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

const backendProxyTarget = (
  process.env.BACKEND_PROXY_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  'http://localhost:8000'
).replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' as const } : {}),
  // Dev: proxy /api/* to Python (or Nest) backend so the browser uses same origin (port 3000)
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${backendProxyTarget}/api/:path*`,
      },
    ];
  },
  trailingSlash: true,
  outputFileTracingRoot: frontendRoot,
  turbopack: {
    root: frontendRoot,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
