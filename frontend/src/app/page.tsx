'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { HomePage } from '@/components/home/HomePage';
import {
  DEFAULT_DEMO_USER_ID,
  DEMO_USER_ID_STORAGE_KEY,
  getDemoHomePath,
  getDemoPersonaById,
  IS_DEMO_MODE,
} from '@/lib/demo-config';

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showHome, setShowHome] = useState(false);

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
      return;
    }

    setShowHome(true);
    setCheckingAuth(false);
  }, [router]);

  if (checkingAuth && !showHome) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-white to-emerald-50">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </main>
    );
  }

  return <HomePage />;
}
