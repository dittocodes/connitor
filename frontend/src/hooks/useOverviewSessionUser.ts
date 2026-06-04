'use client';

import { useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { IS_DEMO_MODE } from '@/lib/demo-config';
import { useDemoRole } from '@/contexts/DemoRoleContext';

export function useOverviewSessionUser<T>() {
  const { demoUser, selectedPersonaId } = useDemoRole();
  const [user, setUser] = useState<T | null>(null);

  useEffect(() => {
    if (IS_DEMO_MODE) {
      setUser(demoUser as T);
      return;
    }

    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('authToken');
    if (!token) {
      setUser(null);
      return;
    }

    try {
      setUser(jwtDecode<T>(token));
    } catch {
      setUser(null);
    }
  }, [demoUser, selectedPersonaId]);

  return user;
}
