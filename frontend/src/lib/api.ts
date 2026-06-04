import axios from 'axios';
import {
  DEFAULT_DEMO_USER_ID,
  DEMO_USER_ID_STORAGE_KEY,
  IS_DEMO_MODE,
  USE_MOCK_API,
} from '@/lib/demo-config';

const configuredBackend = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? '').replace(
  /\/$/,
  '',
);

/** In dev, empty URL uses Next.js rewrite proxy (same origin). Production needs a full API URL. */
const backendBaseUrl =
  configuredBackend ||
  (process.env.NODE_ENV === 'development' ? '' : 'http://localhost:8000');

const apiClient = axios.create({
  baseURL: USE_MOCK_API ? '/' : backendBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (IS_DEMO_MODE) {
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
