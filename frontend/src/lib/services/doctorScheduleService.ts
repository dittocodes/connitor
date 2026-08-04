import apiClient from '@/lib/api';

export type DoctorScheduleSlot = {
  id: string;
  slotStart: string;
  slotEnd: string;
  isBooked: boolean;
  visitId?: string | null;
  label: string;
};

export type CreateSlotsPayload = {
  date?: string;
  fromDate?: string;
  toDate?: string;
  startTime: string;
  endTime: string;
  slotMinutes?: number;
  weekdays?: number[];
};

export const DoctorScheduleService = {
  async listSlots(fromDate: string, toDate: string): Promise<DoctorScheduleSlot[]> {
    const res = await apiClient.get<{ items: DoctorScheduleSlot[] }>('/api/staff/schedule/slots', {
      params: { from: fromDate, to: toDate },
    });
    return res.data.items ?? [];
  },

  async createSlots(payload: CreateSlotsPayload): Promise<{
    created: number;
    skipped: number;
    items: DoctorScheduleSlot[];
  }> {
    const res = await apiClient.post('/api/staff/schedule/slots', payload);
    return res.data;
  },

  async deleteSlot(id: string): Promise<void> {
    await apiClient.delete(`/api/staff/schedule/slots/${id}`);
  },
};
