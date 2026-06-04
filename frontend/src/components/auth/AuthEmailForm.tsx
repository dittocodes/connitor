'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ArrowRight } from 'lucide-react';
import apiClient from '@/lib/api';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import Image from 'next/image';

const EmailFormSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
});

function LoginFormSkeleton() {
  return (
    <Card className="w-full max-w-lg h-auto min-h-[500px] mx-4 sm:mx-auto my-8 sm:my-16 shadow-xl flex flex-col justify-between">
      <CardHeader className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-[220px] rounded-md bg-muted animate-pulse" />
        </div>
        <div className="h-9 w-48 mx-auto rounded bg-muted animate-pulse" />
        <div className="h-5 w-full max-w-sm mx-auto rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
        <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

export function AuthEmailForm() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<z.infer<typeof EmailFormSchema>>({
    resolver: zodResolver(EmailFormSchema),
    defaultValues: { email: '' },
  });

  const {
    formState: { isSubmitting },
  } = form;

  if (!mounted) {
    return <LoginFormSkeleton />;
  }

  const onSubmit = async (data: z.infer<typeof EmailFormSchema>) => {
    setError(null);
    try {
      const res = await apiClient.post<{ message: string; testOtp?: string }>(
        '/api/auth/login',
        { email: data.email.trim().toLowerCase() },
      );
      sessionStorage.setItem('email', data.email.trim().toLowerCase());
      if (res.data.testOtp) {
        toast.message(`Dev OTP: ${res.data.testOtp}`);
      }
      toast.success('OTP sent to your email!');
      router.push('/auth/verify-otp');
    } catch (err: unknown) {
      let errorMessage = 'Failed to send OTP.';
      if (typeof err === 'object' && err && 'response' in err) {
        // @ts-expect-error: dynamic error shape
        errorMessage = err.response?.data?.message || errorMessage;
      }
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  return (
    <Card className="w-full max-w-lg h-auto min-h-[500px] mx-4 sm:mx-auto my-8 sm:my-16 shadow-xl flex flex-col justify-between">
      <CardHeader className="text-center space-y-6">
        <div className="flex justify-center">
          <Image
            src="/ConnInter.png"
            alt="Connitor Logo"
            width={220}
            height={80}
            className="h-auto w-[220px]"
            priority
          />
        </div>

        <CardTitle className="text-3xl font-bold">Welcoming You!</CardTitle>
        <CardDescription className="text-lg">
          Quick and secure login — enter your registered work email to receive a
          one-time password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div
            data-testid="login-error"
            className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md mb-4"
          >
            {error}
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="email-input"
                      type="email"
                      placeholder="you@hospital.com"
                      autoComplete="email"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              data-testid="login-submit"
              className="w-full cursor-pointer"
              disabled={isSubmitting}
              variant="default"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  Send OTP <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
