import apiClient from '@/lib/api';

export interface AttendantPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  name: string;
}

export interface AttendantAdmission {
  id: string;
  status: string;
  wardName?: string | null;
  roomNumber?: string | null;
  bedNumber?: string | null;
  branchId: string;
  hasActivePass?: boolean;
  activePassId?: string | null;
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
  attendant?: AttendantRow | null;
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

  async issuePass(attendantId: string, revokeExisting = false): Promise<AttendantPassRow> {
    const res = await apiClient.post(`/api/attendant-passes/passes/${attendantId}/issue`, {
      revokeExisting,
    });
    return res.data;
  },

  async revokePass(passId: string): Promise<AttendantPassRow> {
    const res = await apiClient.post(`/api/attendant-passes/passes/${passId}/revoke`);
    return res.data;
  },

  async lookupAdmission(branchId: string, mrn: string): Promise<{
    admissionId: string;
    patientFirstName: string;
    wardName?: string | null;
    roomNumber?: string | null;
    hasActivePass: boolean;
    branchId: string;
  }> {
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
