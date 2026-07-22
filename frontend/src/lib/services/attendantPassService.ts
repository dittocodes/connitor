import apiClient from '@/lib/api';

export interface AttendantPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  name: string;
}

export interface VisitingHours {
  admissionId?: string;
  date?: string;
  defaultWindow: {
    startTime: string;
    endTime: string;
    label?: string;
    everyDay?: boolean;
  };
  extraSlots?: VisitSlotRow[];
  summary?: string;
}

export interface VisitSlotRow {
  id: string;
  admissionId: string;
  branchId: string;
  visitDate?: string | null;
  startTime: string;
  endTime: string;
  label?: string | null;
  everyDay?: boolean;
  isActive?: boolean;
  patient?: { id: string; mrn: string; name: string } | null;
  wardName?: string | null;
  roomNumber?: string | null;
}

export interface AttendantAdmission {
  id: string;
  status: string;
  wardName?: string | null;
  roomNumber?: string | null;
  bedNumber?: string | null;
  branchId: string;
  hasActivePass?: boolean;
  hasAttendantInside?: boolean;
  activePassId?: string | null;
  visitingHours?: VisitingHours;
  patient?: AttendantPatient | null;
}

export interface AttendantRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  relationship?: string | null;
  status: string;
  admissionId: string;
  admission?: AttendantAdmission | null;
}

export interface AttendantPassRow {
  id: string;
  passNumber: string;
  status: string;
  attendantId: string;
  validTo?: string | null;
  expiresAt?: string | null;
  enteredAt?: string | null;
  exitedAt?: string | null;
  durationMinutes?: number | null;
  isInside?: boolean;
  attendant?: AttendantRow | null;
}

export interface AttendantPassBranch {
  id: string;
  name: string;
  city: string;
  state: string;
  hospitalChainId: string;
  hospitalChainName?: string | null;
}

export interface AttendantAdmissionLookup {
  admissionId: string;
  patientFirstName: string;
  patientLastName?: string;
  patientName?: string;
  mrn?: string;
  wardName?: string | null;
  roomNumber?: string | null;
  hasActivePass: boolean;
  hasAttendantInside?: boolean;
  branchId: string;
  visitingHours?: VisitingHours;
}

export const AttendantPassService = {
  async listAdmissions(branchId: string): Promise<AttendantAdmission[]> {
    const res = await apiClient.get('/api/attendant-passes/admissions', {
      params: { branchId },
    });
    return res.data.items ?? [];
  },

  async createPatient(data: {
    branchId?: string;
    mrn: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<{ id: string; mrn: string; name: string; branchId: string }> {
    const res = await apiClient.post('/api/attendant-passes/patients', data);
    return res.data;
  },

  async createAdmission(data: {
    patientId: string;
    branchId?: string;
    wardName?: string;
    roomNumber?: string;
    bedNumber?: string;
  }): Promise<AttendantAdmission> {
    const res = await apiClient.post('/api/attendant-passes/admissions', data);
    return res.data;
  },

  async listAttendants(branchId: string, admissionId?: string): Promise<AttendantRow[]> {
    const res = await apiClient.get('/api/attendant-passes/attendants', {
      params: { branchId, admissionId },
    });
    return res.data.items ?? [];
  },

  async registerAttendant(data: {
    admissionId: string;
    name: string;
    email: string;
    phone: string;
    relationship?: string;
  }): Promise<AttendantRow> {
    const res = await apiClient.post('/api/attendant-passes/attendants', data);
    return res.data;
  },

  async approveAttendant(attendantId: string): Promise<AttendantRow> {
    const res = await apiClient.post(`/api/attendant-passes/attendants/${attendantId}/approve`);
    return res.data;
  },

  async listPasses(branchId: string): Promise<AttendantPassRow[]> {
    const res = await apiClient.get('/api/attendant-passes/passes', {
      params: { branchId },
    });
    return res.data.items ?? [];
  },

  async issuePass(
    attendantId: string,
    revokeExisting = false,
  ): Promise<AttendantPassRow & { emailSent?: boolean }> {
    const res = await apiClient.post(`/api/attendant-passes/passes/${attendantId}/issue`, {
      revokeExisting,
    });
    return res.data;
  },

  async revokePass(passId: string): Promise<AttendantPassRow> {
    const res = await apiClient.post(`/api/attendant-passes/passes/${passId}/revoke`);
    return res.data;
  },

  async listVisitSlots(
    branchId: string,
    admissionId?: string,
  ): Promise<{ defaultWindow: VisitingHours['defaultWindow']; items: VisitSlotRow[] }> {
    const res = await apiClient.get('/api/attendant-passes/visit-slots', {
      params: { branchId, admissionId },
    });
    return {
      defaultWindow: res.data.defaultWindow,
      items: res.data.items ?? [],
    };
  },

  async createVisitSlot(data: {
    admissionId: string;
    startTime: string;
    endTime: string;
    visitDate?: string;
    label?: string;
  }): Promise<VisitSlotRow> {
    const res = await apiClient.post('/api/attendant-passes/visit-slots', data);
    return res.data;
  },

  async deleteVisitSlot(slotId: string): Promise<void> {
    await apiClient.delete(`/api/attendant-passes/visit-slots/${slotId}`);
  },

  async listPublicBranches(): Promise<AttendantPassBranch[]> {
    const res = await apiClient.get('/api/public/attendant-passes/branches');
    return res.data ?? [];
  },

  async searchAdmissionsByName(
    branchId: string,
    query: string,
  ): Promise<AttendantAdmissionLookup[]> {
    const res = await apiClient.get('/api/public/attendant-passes/admissions/search', {
      params: { branchId, q: query },
    });
    return res.data.items ?? [];
  },

  async lookupAdmission(branchId: string, mrn: string): Promise<AttendantAdmissionLookup> {
    const res = await apiClient.get('/api/public/attendant-passes/admissions/lookup', {
      params: { branchId, mrn },
    });
    return res.data;
  },

  async publicApply(data: {
    admissionId: string;
    name: string;
    email: string;
    phone: string;
    relationship?: string;
  }): Promise<AttendantRow> {
    const res = await apiClient.post('/api/public/attendant-passes/apply', data);
    return res.data;
  },

  async scanPass(form: FormData): Promise<Record<string, unknown>> {
    const res = await apiClient.post('/api/attendant-passes/passes/scan', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
