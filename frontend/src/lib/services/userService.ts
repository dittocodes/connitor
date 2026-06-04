import apiClient from '@/lib/api';
import {
  UserFormSchema,
  UserResponseSchema,
  UserUpdateSchema,
  UserUpdateData,
} from '@/lib/schema/schema';
import z from 'zod';

export const UserService = {
  async create(userData: z.infer<typeof UserFormSchema>) {
    const validatedData = UserFormSchema.parse(userData);
    const response = await apiClient.post('/api/users', validatedData);
    return UserResponseSchema.parse(response.data);
  },

  async getAll(params?: {
    role?: string;
    isActive?: boolean;
    branchId?: string;
    department?: string;
    chainId?: string;
  }) {
    // Convert isActive to string as expected by backend
    type QueryParams = {
      role?: string;
      isActive?: string;
      branchId?: string;
      department?: string;
      chainId?: string;
    };
    const queryParams: QueryParams = {
      ...params,
      isActive:
        typeof params?.isActive === 'boolean'
          ? params.isActive
            ? 'true'
            : 'false'
          : params?.isActive,
    };
    if (params?.chainId !== undefined) {
      queryParams.chainId = params.chainId;
    }
    const response = await apiClient.get('/api/users', { params: queryParams });
    return z.array(UserResponseSchema).parse(response.data);
  },

  async getStaffByBranch(branchId: string) {
    const response = await apiClient.get(
      `/api/users/staff/by-branch/${branchId}`,
    );
    return response.data;
  },

  async getDepartmentsByBranch(branchId: string) {
    const response = await apiClient.get(
      `/api/users/departments/by-branch/${branchId}`,
    );
    return response.data;
  },

  async getStaffByDepartment(branchId: string, department: string) {
    const response = await apiClient.get(
      `/api/users/staff/by-department/${branchId}/${department}`,
    );
    return response.data;
  },

  async getById(id: string) {
    const response = await apiClient.get(`/api/users/${id}`);
    return UserResponseSchema.parse(response.data);
  },

  async update(id: string, userData: UserUpdateData) {
    const validatedData = UserUpdateSchema.parse(userData);
    const response = await apiClient.put(`/api/users/${id}`, validatedData);
    return UserResponseSchema.parse(response.data);
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/users/${id}`);
    return response.data;
  },
};
