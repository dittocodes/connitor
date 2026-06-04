'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_DEMO_USER_ID,
  DEMO_USER_ID_STORAGE_KEY,
  getDemoHomePath,
  getDemoPersonaById,
  IS_DEMO_MODE,
} from '@/lib/demo-config';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (IS_DEMO_MODE) {
      const storedId =
        sessionStorage.getItem(DEMO_USER_ID_STORAGE_KEY) ?? DEFAULT_DEMO_USER_ID;
      const persona = getDemoPersonaById(storedId);
      router.replace(getDemoHomePath(persona.role));
      return;
    }

    const token = localStorage.getItem('authToken');

    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/auth/login');
    }
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading...</p>
    </main>
  );
}
