import axios from 'axios';
import {
  DEFAULT_DEMO_USER_ID,
  DEMO_USER_ID_STORAGE_KEY,
  IS_DEMO_MODE,
  USE_MOCK_API,
} from '@/lib/demo-config';
import { getStoredAuthToken } from '@/lib/auth-storage';

const configuredBackend = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? '').replace(
  /\/$/,
  '',
);

/** In dev, empty URL uses Next.js rewrite proxy (same origin). Production needs a full API URL. */
const backendBaseUrl =
  configuredBackend ||
  (process.env.NODE_ENV === 'development' ? '' : 'http://127.0.0.1:8001');

const apiClient = axios.create({
  baseURL: USE_MOCK_API ? '/' : backendBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Next.js uses trailingSlash: true — API paths need a slash before the query string. */
function withApiTrailingSlash(url: string | undefined): string | undefined {
  if (!url || !url.startsWith('/api/')) {
    return url;
  }
  const queryIndex = url.indexOf('?');
  const path = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
  const query = queryIndex >= 0 ? url.slice(queryIndex) : '';
  if (path.endsWith('/')) {
    return url;
  }
  return `${path}/${query}`;
}

if (typeof window !== 'undefined') {
  apiClient.defaults.adapter = async (config) => {
    if (USE_MOCK_API) {
      const { handleMockRequest } = await import('@/lib/mock/mock-api-handler');
      return handleMockRequest(config);
    }

    const networkAdapter = axios.getAdapter(axios.defaults.adapter);
    return networkAdapter(config);
  };

  apiClient.interceptors.request.use(
    (config) => {
      config.url = withApiTrailingSlash(config.url);

      const token = getStoredAuthToken();
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (IS_DEMO_MODE && !getStoredAuthToken()) {
        const demoUserId =
          sessionStorage.getItem(DEMO_USER_ID_STORAGE_KEY) ?? DEFAULT_DEMO_USER_ID;
        config.headers['x-demo-user-id'] = demoUserId;
      }

      return config;
    },
    (error) => Promise.reject(error),
  );
}

export default apiClient;
