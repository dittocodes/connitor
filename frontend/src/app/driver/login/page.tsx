'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DriverAuthService } from '@/lib/services/driverAuthService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DriverLoginPage(): React.ReactElement {
  const router = useRouter();
  const [mode, setMode] = React.useState<'password' | 'otp'>('password');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [otpSent, setOtpSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const loginPassword = async () => {
    setLoading(true);
    try {
      await DriverAuthService.login(email, password);
      router.push('/driver/dashboard');
    } catch {
      toast.error('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async () => {
    setLoading(true);
    try {
      const res = await DriverAuthService.requestOtp(email);
      setOtpSent(true);
      if (res.testOtp) toast.message(`Test OTP: ${res.testOtp}`);
      else toast.success('OTP sent to your email');
    } catch {
      toast.error('Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      await DriverAuthService.verifyOtp(email, otp);
      router.push('/driver/dashboard');
    } catch {
      toast.error('Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Driver login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in to view your delivery assignment and check-in QR code.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={mode === 'password' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('password')}
            >
              Password
            </Button>
            <Button
              variant={mode === 'otp' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('otp')}
            >
              Email OTP
            </Button>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === 'password' ? (
            <>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button className="w-full" disabled={loading} onClick={() => void loginPassword()}>
                Sign in
              </Button>
            </>
          ) : !otpSent ? (
            <Button className="w-full" disabled={loading} onClick={() => void requestOtp()}>
              Send OTP
            </Button>
          ) : (
            <>
              <div>
                <Label>OTP</Label>
                <Input value={otp} onChange={(e) => setOtp(e.target.value)} />
              </div>
              <Button className="w-full" disabled={loading} onClick={() => void verifyOtp()}>
                Verify OTP
              </Button>
            </>
          )}
          <p className="text-xs text-center text-muted-foreground">
            Hospital staff?{' '}
            <Link href="/auth/login" className="text-teal-700 underline">
              Staff login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
