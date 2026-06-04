'use client';

import { useState, useEffect } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { getDemoHomePath, IS_DEMO_MODE } from '@/lib/demo-config';
import { useDemoRole } from '@/contexts/DemoRoleContext';

interface UseAuthSessionOptions {
  requiredRole?: string;
  redirectTo?: string;
}

export function useAuthSession<T extends { role?: string }>(
  options: UseAuthSessionOptions = {},
) {
  const { requiredRole, redirectTo = '/auth/login' } = options;
  const [user, setUser] = useState<T | null>(null);
  const router = useRouter();
  const { demoUser } = useDemoRole();

  useEffect(() => {
    if (IS_DEMO_MODE) {
      if (requiredRole && demoUser.role !== requiredRole) {
        router.replace(getDemoHomePath(demoUser.role));
      }
      return;
    }

    const token = localStorage.getItem('authToken');

    if (!token) {
      router.push(redirectTo);
      return;
    }

    try {
      const decodedUser = jwtDecode<T>(token);

      if (requiredRole && decodedUser.role !== requiredRole) {
        notFound();
        return;
      }

      setUser(decodedUser);
    } catch (error) {
      console.error('Failed to decode token:', error);
      localStorage.removeItem('authToken');
      router.push(redirectTo);
    }
  }, [router, requiredRole, redirectTo, demoUser]);

  if (IS_DEMO_MODE) {
    if (requiredRole && demoUser.role !== requiredRole) {
      return null;
    }

    return demoUser as unknown as T;
  }

  return user;
}
