'use client';

import { DemoRoleProvider } from '@/contexts/DemoRoleContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <DemoRoleProvider>{children}</DemoRoleProvider>;
}
