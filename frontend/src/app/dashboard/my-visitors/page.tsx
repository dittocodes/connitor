'use client';

import MyVisitors from '@/components/myVisitors/MyVisitors';
import { useAuthSession } from '@/hooks/useAuthSession';

interface User {
  name: string;
  role:
    | 'SUPER_ADMIN'
    | 'CHAIN_ADMIN'
    | 'BRANCH_ADMIN'
    | 'SECURITY'
    | 'STAFF'
    | 'SECURITY_SUPERVISOR';
  phone: string;
  email: string;
  id: string;
  isActive: boolean;
  hospitalChainId: string | null;
  branchId: string | null;
  userType:
    | 'DOCTOR'
    | 'NURSE'
    | 'SURGEON'
    | 'RECEPTIONIST'
    | 'PHARMACIST'
    | 'LAB_TECHNICIAN'
    | 'DEPARTMENT_HEAD'
    | 'IT_SUPPORT'
    | null;
  department:
    | 'IT_SUPPORT'
    | 'GENERAL_MEDICINE'
    | 'CARDIOLOGY'
    | 'NEUROLOGY'
    | 'ORTHOPEDICS'
    | 'RADIOLOGY'
    | 'PHARMACY'
    | 'ADMINISTRATION'
    | null;
  location: string | null;
  createdAt: string;
}

export default function StaffPage() {
  const user = useAuthSession<User>({ requiredRole: 'STAFF' });

  if (!user) return null;

  return <MyVisitors user={user} />;
}
