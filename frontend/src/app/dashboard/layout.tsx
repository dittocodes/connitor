'use client';

import DashboardLayoutClient from './DashboardLayoutClient';
import { useAuthSession } from '@/hooks/useAuthSession';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
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
