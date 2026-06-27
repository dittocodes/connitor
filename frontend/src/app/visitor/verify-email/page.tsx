'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VisitorAccountApi } from '@/features/visitor-pre-registration/api/visitorAccountService';

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get('token');
  const verified = params.get('verified');
  const error = params.get('error');
  const activated = params.get('activated');
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [isActivated, setIsActivated] = useState(false);

  useEffect(() => {
    if (verified === '1') {
      setStatus('ok');
      setMessage(
        activated === '1'
          ? 'Email verified and your account is now active.'
          : 'Email verified successfully.',
      );
      setIsActivated(activated === '1');
      toast.success(activated === '1' ? 'Account activated' : 'Email verified');
      return;
    }

    if (error === '1') {
      setStatus('error');
      setMessage('This link is invalid or expired.');
      return;
    }

    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    VisitorAccountApi.verifyEmailToken(token)
      .then((res) => {
        setStatus('ok');
        setMessage(res.message);
        setIsActivated(Boolean(res.activated || res.profileStatus === 'ACTIVE'));
        toast.success(res.activated ? 'Account activated' : 'Email verified');
      })
      .catch(() => {
        setStatus('error');
        setMessage('This link is invalid or expired.');
      });
  }, [token, verified, error, activated]);

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Email verification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'loading' && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying…
          </p>
        )}
        {status !== 'loading' && <p>{message}</p>}
        {isActivated || status === 'ok' ? (
          <Button asChild>
            <Link href="/visitor/login">Sign in</Link>
          </Button>
        ) : status === 'error' ? (
          <Button asChild>
            <Link href="/visitor/register">Return to registration</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
