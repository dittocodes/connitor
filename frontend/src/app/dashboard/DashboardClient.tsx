'use client';

import { notFound } from 'next/navigation';

import SuperAdminOverview from '@/components/overview/SuperAdminOverview';
import ChainAdminOverview from '@/components/overview/ChainAdminOverview';
import BranchAdminOverview from '@/components/overview/BranchAdminOverview';
import SecurityOverview from '@/components/overview/SecurityOverview';
import StaffOverview from '@/components/overview/StaffOverview';

export type User = {
  id: string;
  name: string;
  role: string;
  hospitalChainId?: string;
  branchId?: string;
};

export default function DashboardClient({ user }: { user: User | null }) {
  if (!user) return notFound();

  switch (user.role) {
    case 'SUPER_ADMIN':
      return <SuperAdminOverview />;
    case 'CHAIN_ADMIN':
      return <ChainAdminOverview />;
    case 'BRANCH_ADMIN':
      return <BranchAdminOverview />;
    case 'SECURITY':
      return <SecurityOverview />;
    case 'STAFF':
      return <StaffOverview />;
    default:
      return notFound();
  }
}
