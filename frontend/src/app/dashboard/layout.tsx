'use client';

import DashboardLayoutClient from './DashboardLayoutClient';
import { useAuthSession } from '@/hooks/useAuthSession';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  hospitalChainId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  subDepartmentId?: string | null;
  departmentName?: string;
  subDepartmentName?: string;
  hospitalChain: {
    name: string;
  } | null;
  branch: {
    name: string;
  } | null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useAuthSession<User>();

  if (!user) {
    return null;
  }

  return <DashboardLayoutClient user={user}>{children}</DashboardLayoutClient>;
}
