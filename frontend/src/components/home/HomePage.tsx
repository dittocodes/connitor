'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  LogIn,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const FEATURES = [
  {
    icon: Users,
    title: 'Visitor management',
    description: 'Register, approve, and track every visitor across hospital branches.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure access',
    description: 'Email OTP login and role-based permissions keep your facility protected.',
  },
  {
    icon: BarChart3,
    title: 'Real-time insights',
    description: 'Dashboards and analytics for admins, security, and staff teams.',
  },
] as const;

export function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50">
      <header className="border-b border-teal-100/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/ConnInter.png"
              alt="Connitor"
              width={160}
              height={48}
              className="h-10 w-auto sm:h-11"
              priority
            />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" className="text-teal-800 hover:text-teal-900">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white shadow-md">
              <Link href="/auth/register">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <section className="space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 text-sm font-medium text-teal-800">
              Hospital Visitor Tracking System
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                Smarter visitor tracking for modern hospitals
              </h1>
              <p className="mx-auto max-w-xl text-lg text-slate-600 lg:mx-0">
                Connitor helps hospital teams manage visitors, streamline check-ins,
                and keep every branch secure — with a simple email OTP sign-in.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button
                asChild
                size="lg"
                className="h-12 bg-teal-600 px-8 text-base hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20"
              >
                <Link href="/auth/login">
                  <LogIn className="mr-2 h-5 w-5" />
                  Sign in to dashboard
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-teal-200 bg-white/80 px-8 text-base text-teal-800 hover:bg-teal-50"
              >
                <Link href="/auth/register">
                  <UserPlus className="mr-2 h-5 w-5" />
                  Create account
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 pt-2 sm:grid-cols-3 lg:max-w-none">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-xl border border-teal-100 bg-white/80 p-4 text-left shadow-sm backdrop-blur-sm"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md border-teal-100/80 shadow-xl shadow-teal-900/5">
              <CardHeader className="space-y-3 pb-2 text-center">
                <CardTitle className="text-2xl font-bold text-slate-900">
                  Welcome to Connitor
                </CardTitle>
                <CardDescription className="text-base text-slate-600">
                  Staff and hospital teams can sign in or register to get started.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <Button
                  asChild
                  className="h-12 w-full bg-teal-600 text-base hover:bg-teal-700"
                >
                  <Link href="/auth/login">
                    <LogIn className="mr-2 h-5 w-5" />
                    Sign in with email OTP
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-12 w-full border-teal-200 text-base text-teal-800 hover:bg-teal-50"
                >
                  <Link href="/auth/register">
                    <UserPlus className="mr-2 h-5 w-5" />
                    Register new account
                  </Link>
                </Button>

                <div className="rounded-lg bg-teal-50/80 px-4 py-3 text-sm text-teal-900">
                  <p className="font-medium">New here?</p>
                  <p className="mt-1 text-teal-800/90">
                    Register with your work email, verify with OTP, then sign in anytime
                    using the same email OTP flow.
                  </p>
                </div>

                <ul className="space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                    Chain, branch, staff &amp; security roles
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                    Email verification during registration
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                    Secure passwordless login
                  </li>
                </ul>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <footer className="border-t border-teal-100/80 bg-white/50 py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-slate-500 sm:px-6">
          © {new Date().getFullYear()} Connitor · Hospital Visitor Tracking System
        </div>
      </footer>
    </div>
  );
}
