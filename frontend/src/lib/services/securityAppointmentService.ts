import apiClient from '@/lib/api';

export interface TodayAppointment {
  visitId: string;
  visitorName: string;
  visitorPhone: string;
  doctorName: string | null;
  appointmentDate: string | null;
  status: string;
  idProofVerified: boolean;
  purpose: string | null;
  doctorConfirmed?: boolean;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  appointmentMode?: string;
  isOnline?: boolean;
  zoomJoinUrl?: string | null;
}

export const ID_PROOF_TYPES = [
  'AADHAAR',
  'PAN',
  'DRIVING_LICENSE',
  'PASSPORT',
  'VOTER_ID',
] as const;

export type IdProofType = (typeof ID_PROOF_TYPES)[number];

export const SecurityAppointmentService = {
  async getPendingAppointments(): Promise<{ appointments: TodayAppointment[]; total: number }> {
    const response = await apiClient.get<{ appointments: TodayAppointment[]; total: number }>(
      '/api/security/appointments/pending',
    );
    return response.data;
  },

  async getTodayAppointments(): Promise<{ appointments: TodayAppointment[]; total: number }> {
    const response = await apiClient.get<{ appointments: TodayAppointment[]; total: number }>(
      '/api/security/appointments/today',
    );
    return response.data;
  },

  async getConfirmedAppointments(): Promise<{ appointments: TodayAppointment[]; total: number }> {
    const response = await apiClient.get<{ appointments: TodayAppointment[]; total: number }>(
      '/api/security/appointments/confirmed',
    );
    return response.data;
  },

  async verifyIdProof(
    visitId: string,
    data: { idProofType: IdProofType; idProofNumber: string },
  ): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      `/api/security/visits/${visitId}/verify-id-proof`,
      data,
    );
    return response.data;
  },
};
