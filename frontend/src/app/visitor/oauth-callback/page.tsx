'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { VisitorAuthService } from '@/lib/services/visitorAuthService';

function OAuthCallbackContent() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      VisitorAuthService.storeOAuthToken(token);
      toast.success('Signed in successfully');
      router.replace('/visitor/dashboard');
    } else {
      toast.error('OAuth sign-in failed');
      router.replace('/visitor/login');
    }
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function VisitorOAuthCallbackPage() {
  return (
    <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
