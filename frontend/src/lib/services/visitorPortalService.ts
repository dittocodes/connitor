import apiClient from '@/lib/api';

export interface VisitorAppointment {
  bookingId: string;
  status: string;
  purpose: string | null;
  appointmentDate: string | null;
  doctorName: string | null;
  doctorFeedback: string | null;
  doctorFeedbackAt: string | null;
  rejectionReason: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalDurationMinutes: number | null;
  branchName: string | null;
  departmentName: string | null;
  subDepartmentName: string | null;
  createdAt: string | null;
  checkInQrCode?: string | null;
  checkInOtp?: string | null;
  checkInOtpExpiry?: string | null;
}

export interface VisitorDashboardData {
  phone: string;
  visitorName: string;
  email: string | null;
  totalAppointments: number;
  appointments: VisitorAppointment[];
  profile?: {
    accountId: string;
    fullName: string;
    photoUrl?: string | null;
    headline?: string | null;
    emailType?: string;
    linkedinUrl?: string | null;
  };
}

const VISITOR_TOKEN_KEY = 'visitorAuthToken';

export function getVisitorToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(VISITOR_TOKEN_KEY);
}

export function setVisitorToken(token: string): void {
  localStorage.setItem(VISITOR_TOKEN_KEY, token);
}

export function clearVisitorToken(): void {
  localStorage.removeItem(VISITOR_TOKEN_KEY);
}

export const VisitorPortalService = {
  async requestOtp(email: string): Promise<{ message: string; testOtp?: string }> {
    const response = await apiClient.post('/api/public/visitor-portal/request-otp', { email });
    return response.data;
  },

  async verifyOtp(
    email: string,
    otp: string,
  ): Promise<{ access_token: string; email: string; name: string }> {
    const response = await apiClient.post('/api/public/visitor-portal/verify-otp', { email, otp });
    return response.data;
  },

  async getAppointments(): Promise<VisitorDashboardData> {
    const token = getVisitorToken();
    const response = await apiClient.get('/api/public/visitor-portal/appointments', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.data;
  },
};
