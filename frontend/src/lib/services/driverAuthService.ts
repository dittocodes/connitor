import axios from 'axios';
import { getStoredDriverToken, setStoredDriverToken, clearStoredDriverToken } from '@/lib/driver-auth-storage';

const driverApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8001',
});

driverApi.interceptors.request.use((config) => {
  const token = getStoredDriverToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface DriverAssignment {
  id: string;
  deliveryNumber: string;
  status: string;
  goodsType: string;
  totalBoxes: number;
  remarks: string | null;
  expectedArrivalTime: string | null;
  vehicleNumber: string | null;
  vendorName: string | null;
  hospital: {
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string;
    street: string | null;
    city: string | null;
    state: string | null;
    pinCode: string | null;
  };
  qr: {
    qrPayload: string;
    signature: string;
    expiresAt: string;
  } | null;
}

export const DriverAuthService = {
  async login(email: string, password: string): Promise<void> {
    const res = await driverApi.post<{ access_token: string }>('/api/delivery/driver-auth/login', {
      email,
      password,
    });
    setStoredDriverToken(res.data.access_token);
  },

  async requestOtp(email: string): Promise<{ testOtp?: string }> {
    const res = await driverApi.post<{ message: string; testOtp?: string }>(
      '/api/delivery/driver-auth/request-otp',
      { email },
    );
    return { testOtp: res.data.testOtp };
  },

  async verifyOtp(email: string, otp: string): Promise<void> {
    const res = await driverApi.post<{ access_token: string }>(
      '/api/delivery/driver-auth/verify-otp',
      { email, otp },
    );
    setStoredDriverToken(res.data.access_token);
  },

  logout(): void {
    clearStoredDriverToken();
  },

  isLoggedIn(): boolean {
    return Boolean(getStoredDriverToken());
  },

  async getAssignments(): Promise<DriverAssignment[]> {
    const res = await driverApi.get<{ assignments: DriverAssignment[] }>(
      '/api/delivery/driver/assignments',
    );
    return res.data.assignments;
  },
};
