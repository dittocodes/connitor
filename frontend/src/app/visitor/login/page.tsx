'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import {
  getBackendUnreachableMessage,
  isBackendUnreachable,
} from '@/lib/api-errors';
import {
  VisitorPortalService,
  getVisitorToken,
  setVisitorToken,
} from '@/lib/services/visitorPortalService';
import { VisitorAuthService } from '@/lib/services/visitorAuthService';

const EmailSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
});

const PasswordLoginSchema = z.object({
  identifier: z.string().min(3, 'Enter email or phone'),
  password: z.string().min(8, 'Enter your password'),
});

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isBackendUnreachable(error)) {
    return getBackendUnreachableMessage();
  }
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data as { message?: string; detail?: string };
    const detail = data.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg;
    }
    return data.message ?? fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ''}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export default function VisitorLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50" />}>
      <VisitorLoginContent />
    </Suspense>
  );
}

function VisitorLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [mode, setMode] = useState<'password' | 'legacy-otp'>('password');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const postLoginPath =
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/visitor/dashboard';

  useEffect(() => {
    if (getVisitorToken()) {
      router.replace(postLoginPath);
    }
  }, [router, postLoginPath]);

  const emailForm = useForm<z.infer<typeof EmailSchema>>({
    resolver: zodResolver(EmailSchema),
    defaultValues: { email: '' },
  });

  const passwordForm = useForm<z.infer<typeof PasswordLoginSchema>>({
    resolver: zodResolver(PasswordLoginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  useEffect(() => {
    const identifier = searchParams.get('identifier')?.trim();
    if (identifier) {
      passwordForm.setValue('identifier', identifier);
    }
  }, [searchParams, passwordForm]);

  const loginWithPassword = async (data: z.infer<typeof PasswordLoginSchema>) => {
    setLoading(true);
    try {
      const result = await VisitorAuthService.login(data.identifier, data.password);
      toast.success(`Welcome back, ${result.name}!`);
      router.push(postLoginPath);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Invalid credentials.'));
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async (data: z.infer<typeof EmailSchema>) => {
    setLoading(true);
    try {
      const normalized = data.email.trim().toLowerCase();
      const result = await VisitorPortalService.requestOtp(normalized);
      setEmail(normalized);
      setStep('otp');
      if (result.testOtp) {
        toast.message(`Dev OTP: ${result.testOtp}`);
      }
      toast.success(result.message);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Could not send OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length < 6) {
      toast.error('Enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const result = await VisitorPortalService.verifyOtp(email, otp);
      setVisitorToken(result.access_token);
      toast.success('Welcome back!');
      router.push(postLoginPath);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Invalid OTP.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50">
      <header className="border-b border-teal-100/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/">
            <Image src="/ConnInter.png" alt="Connitor" width={140} height={44} className="h-9 w-auto" />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Visitor sign in</CardTitle>
            <CardDescription>
              {mode === 'password'
                ? 'Sign in with your Connitor profile (email or phone + password).'
                : 'Legacy sign-in: email OTP after booking an appointment without a profile.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'password' ? (
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(loginWithPassword)} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="identifier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email or mobile</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="username" placeholder="you@example.com or 9876543210" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" autoComplete="current-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
                  </Button>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" asChild>
                      <a href={VisitorAuthService.getGoogleAuthUrl()}>Continue with Google</a>
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <a href={VisitorAuthService.getLinkedInAuthUrl()}>Continue with LinkedIn</a>
                    </Button>
                  </div>
                  <Button type="button" variant="link" className="w-full px-0" onClick={() => setMode('legacy-otp')}>
                    Booked without a profile? Use email OTP
                  </Button>
                </form>
              </Form>
            ) : step === 'email' ? (
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(sendOtp)} className="space-y-4">
                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email address</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send email OTP'}
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to <strong>{maskEmail(email)}</strong>
                </p>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button className="w-full" onClick={verifyOtp} disabled={loading || otp.length < 6}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & open dashboard'}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setStep('email')}>
                  Use a different email
                </Button>
                <Button variant="link" className="w-full" onClick={() => setMode('password')}>
                  Back to password sign in
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          No profile yet?{' '}
          <Link
            href={
              returnTo
                ? `/visitor/register?returnTo=${encodeURIComponent(returnTo)}`
                : '/visitor/register'
            }
            className="text-teal-700 underline font-medium"
          >
            Create your Connitor profile
          </Link>
          {' · '}
          <Link href="/book-appointment" className="text-teal-700 underline font-medium">
            Book an appointment
          </Link>
        </p>
      </div>
    </div>
  );
}
