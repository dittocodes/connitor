'use client';

import { notFound } from 'next/navigation';
import { useAuthSession } from '@/hooks/useAuthSession';

import SuperAdminSetting from '@/components/settings/SuperAdminSetting';
import ChainAdminSetting from '@/components/settings/ChainAdminSetting';
import BranchAdminSetting from '@/components/settings/BranchAdminSetting';
import SecuritySetting from '@/components/settings/SecuritySetting';
import StaffSetting from '@/components/settings/StaffSetting';

interface User {
  id: string;
  name: string;
  role: 'SUPER_ADMIN' | 'CHAIN_ADMIN' | 'BRANCH_ADMIN' | 'SECURITY' | 'STAFF';
}

export default function SettingPage() {
  const user = useAuthSession<User>();

  if (!user) {
    return null;
  }

  switch (user.role) {
    case 'SUPER_ADMIN':
      return <SuperAdminSetting />;
    case 'CHAIN_ADMIN':
      return <ChainAdminSetting />;
    case 'BRANCH_ADMIN':
      return <BranchAdminSetting />;
    case 'SECURITY':
      return <SecuritySetting />;
    case 'STAFF':
      return <StaffSetting />;
    default:
      notFound();
  }
}
