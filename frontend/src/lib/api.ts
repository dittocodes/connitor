import axios from 'axios';
import {
  DEFAULT_DEMO_USER_ID,
  DEMO_USER_ID_STORAGE_KEY,
  IS_DEMO_MODE,
  USE_MOCK_API,
} from '@/lib/demo-config';
import { getBackendBaseUrl } from '@/lib/backend-url';
import { getStoredAuthToken } from '@/lib/auth-storage';

function resolveBaseUrl(): string {
  return USE_MOCK_API ? '/' : getBackendBaseUrl();
}

const apiClient = axios.create({
  baseURL: resolveBaseUrl(),
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
      config.baseURL = resolveBaseUrl();
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
