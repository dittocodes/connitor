'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthOtpForm } from '@/components/auth/AuthOtpForm';
import { IS_DEMO_MODE } from '@/lib/demo-config';

export default function VerifyOtpPage() {
  const router = useRouter();

  useEffect(() => {
    if (IS_DEMO_MODE) {
      router.replace('/dashboard');
    }
  }, [router]);

  if (IS_DEMO_MODE) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4">
      <AuthOtpForm />
    </div>
  );
}
