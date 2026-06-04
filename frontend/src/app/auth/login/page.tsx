'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthEmailForm } from '@/components/auth/AuthEmailForm';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { getDemoHomePath, IS_DEMO_MODE } from '@/lib/demo-config';
import { useDemoRole } from '@/contexts/DemoRoleContext';

export default function LoginPage() {
  const router = useRouter();
  const { demoUser } = useDemoRole();

  useEffect(() => {
    if (IS_DEMO_MODE) {
      router.replace(getDemoHomePath(demoUser.role));
    }
  }, [router, demoUser.role]);

  if (IS_DEMO_MODE) {
    return null;
  }

  return (
    <AuthPageShell>
      <AuthEmailForm />
    </AuthPageShell>
  );
}
