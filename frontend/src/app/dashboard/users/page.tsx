'use client';

import { useEffect } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { useAuthSession } from '@/hooks/useAuthSession';
import { getDemoHomePath, IS_DEMO_MODE } from '@/lib/demo-config';

import SuperAdminUser from '@/components/users/SuperAdminUser';
import { ChainAdminUser } from '@/components/users/ChainAdminUser';
import { BranchAdminUser } from '@/components/users/BranchAdminUser';

interface User {
  id: string;
  name: string;
  role: 'SUPER_ADMIN' | 'CHAIN_ADMIN' | 'BRANCH_ADMIN' | 'SECURITY' | 'STAFF';
  hospitalChainId?: string;
  branchId?: string;
}

function canAccessUsersPage(user: User): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'CHAIN_ADMIN') return typeof user.hospitalChainId === 'string';
  if (user.role === 'BRANCH_ADMIN') {
    return (
      typeof user.branchId === 'string' &&
      typeof user.hospitalChainId === 'string'
    );
  }
  return false;
}

export default function UsersPage() {
  const user = useAuthSession<User>();
  const router = useRouter();

  useEffect(() => {
    if (!user || canAccessUsersPage(user)) return;

    if (IS_DEMO_MODE) {
      router.replace(getDemoHomePath(user.role));
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  if (!canAccessUsersPage(user)) {
    if (IS_DEMO_MODE) {
      return null;
    }

    notFound();
  }

  switch (user.role) {
    case 'SUPER_ADMIN':
      return <SuperAdminUser />;
    case 'CHAIN_ADMIN':
      return (
        <ChainAdminUser
          user={{ ...user, hospitalChainId: user.hospitalChainId as string }}
        />
      );
    case 'BRANCH_ADMIN':
      return (
        <BranchAdminUser
          user={{
            branchId: user.branchId as string,
            hospitalChainId: user.hospitalChainId as string,
          }}
        />
      );
    default:
      if (IS_DEMO_MODE) {
        return null;
      }

      notFound();
  }
}
