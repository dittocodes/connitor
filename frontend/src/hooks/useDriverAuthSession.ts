'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { getStoredDriverToken } from '@/lib/driver-auth-storage';

interface DriverJwt {
  role?: string;
  deliveryAgentId?: string;
  name?: string;
  email?: string;
}

export function useDriverAuthSession() {
  const router = useRouter();
  const [user, setUser] = React.useState<DriverJwt | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const token = getStoredDriverToken();
    if (!token) {
      setUser(null);
      setReady(true);
      router.replace('/driver/login');
      return;
    }
    try {
      const decoded = jwtDecode<DriverJwt>(token);
      if (decoded.role !== 'DELIVERY_AGENT') {
        setUser(null);
        router.replace('/driver/login');
      } else {
        setUser(decoded);
      }
    } catch {
      router.replace('/driver/login');
    }
    setReady(true);
  }, [router]);

  return { user, ready };
}
