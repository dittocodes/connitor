import apiClient from '@/lib/api';
import { RejectVisitFormData } from '@/lib/schema/schema';

export interface StaffVisitor {
  id: string;
  purpose: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  durationMinutes?: number | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  visitor: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
    phone: string;
  };
  visitCode?: string | null;
  visitQRCode?: string | null;
}

export const StaffService = {
  async getPendingVisits(): Promise<StaffVisitor[]> {
    const response = await apiClient.get('/api/staff/pending-visits');
    return response.data;
  },

  async getVisitorHistory(): Promise<StaffVisitor[]> {
    const response = await apiClient.get('/api/staff/history');
    return response.data;
  },

  async approveVisit(visitId: string) {
    const response = await apiClient.patch(
      `/api/staff/visits/${visitId}/approve`,
    );
    return response.data;
  },

  async rejectVisit(visitId: string, data: RejectVisitFormData) {
    const response = await apiClient.patch(
      `/api/staff/visits/${visitId}/reject`,
      data,
    );
    return response.data;
  },
};
