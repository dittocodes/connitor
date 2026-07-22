'use client';

import { DemoRoleProvider } from '@/contexts/DemoRoleContext';
import { GlobalMutationLoader } from '@/components/GlobalMutationLoader';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DemoRoleProvider>
      {children}
      <GlobalMutationLoader />
    </DemoRoleProvider>
  );
}
