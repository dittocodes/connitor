import apiClient from '@/lib/api';

export interface ApprovedBranch {
  id: string;
  name: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
}

export interface DeliverySlot {
  id: string;
  branchId: string;
  slotStart: string;
  slotEnd: string;
  maxDeliveries: number;
  bookedCount: number;
  remaining: number;
  isActive: boolean;
}

export interface DeliveryAgent {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  licenseNumber: string | null;
  hasLogin: boolean;
}

export interface DeliveryVehicle {
  id: string;
  registrationNumber: string;
  vehicleType: string | null;
}

export interface BookDeliveryPayload {
  branchId: string;
  slotId?: string | null;
  expectedArrivalTime?: string | null;
  goodsType: string;
  totalBoxes: number;
  vehicleId?: string;
  vehicle?: { registrationNumber: string; vehicleType?: string };
  agentId?: string;
  agent?: { name: string; email: string; phone?: string };
  remarks?: string;
}

export const DistributorDeliveryService = {
  async listBranches(): Promise<ApprovedBranch[]> {
    const res = await apiClient.get<{ branches: ApprovedBranch[] }>(
      '/api/delivery/distributors/me/branches',
    );
    return res.data.branches;
  },

  async listSlots(branchId: string, date: string): Promise<DeliverySlot[]> {
    const res = await apiClient.get<{ slots: DeliverySlot[] }>(
      `/api/delivery/branches/${branchId}/slots`,
      { params: { date } },
    );
    return res.data.slots;
  },

  async getBranchSettings(branchId: string): Promise<{ allowUnscheduledDeliveries: boolean }> {
    const res = await apiClient.get<{ allowUnscheduledDeliveries: boolean }>(
      `/api/delivery/branch-settings/${branchId}`,
    );
    return res.data;
  },

  async listAgents(): Promise<DeliveryAgent[]> {
    const res = await apiClient.get<{ agents: DeliveryAgent[] }>('/api/delivery/agents');
    return res.data.agents;
  },

  async listVehicles(): Promise<DeliveryVehicle[]> {
    const res = await apiClient.get<{ vehicles: DeliveryVehicle[] }>('/api/delivery/vehicles');
    return res.data.vehicles;
  },

  async bookDelivery(payload: BookDeliveryPayload) {
    const res = await apiClient.post('/api/delivery/deliveries/book', payload);
    return res.data;
  },

  async listDeliveries() {
    const res = await apiClient.get('/api/delivery/deliveries');
    return res.data;
  },
};
