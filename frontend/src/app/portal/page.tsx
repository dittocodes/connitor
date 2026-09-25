'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  ArrowRight,
  Building2,
  Shield,
  Truck,
  UserRound,
} from 'lucide-react';

import { ConninterWordmark } from '@/components/brand/ConninterWordmark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PortalCard = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

const CARDS: PortalCard[] = [
  {
    id: 'visitor',
    title: 'Visitors',
    description: 'Sign in or create an account to book hospital visits and track appointments.',
    icon: UserRound,
    primaryHref: '/visitor/login',
    primaryLabel: 'Visitor sign in',
    secondaryHref: '/visitor/register',
    secondaryLabel: 'Create visitor account',
  },
  {
    id: 'staff',
    title: 'Hospital staff',
    description: 'Doctors, reception, and admins — open your role dashboard with work email.',
    icon: Building2,
    primaryHref: '/auth/login',
    primaryLabel: 'Staff sign in',
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Gate check-in, QR scan, and visitor verification for security teams.',
    icon: Shield,
    primaryHref: '/auth/login?role=SECURITY',
    primaryLabel: 'Security sign in',
  },
  {
    id: 'distributor',
    title: 'Distributors & vendors',
    description: 'Book delivery slots, manage fleet, and track hospital deliveries.',
    icon: Truck,
    primaryHref: '/auth/login?role=DISTRIBUTOR',
    primaryLabel: 'Vendor sign in',
    secondaryHref: '/vendor/register',
    secondaryLabel: 'Register as vendor',
  },
];

function PortalContent() {
  const searchParams = useSearchParams();
  const intent = searchParams.get('intent');
  const preferRegister = intent === 'register';

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#4A90E2]/15 blur-3xl" />
        <div className="absolute -right-16 top-40 h-80 w-80 rounded-full bg-[#001B71]/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-[#001B71]/08 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <ConninterWordmark size="md" />
          <Button asChild variant="ghost" size="sm" className="text-primary">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-10 max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#4A90E2]">
            Sign in hub
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
            Choose how you connect
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            {preferRegister
              ? 'Create an account for your role, or jump straight into the right sign-in flow.'
              : 'Pick your portal to continue into the live Conninter application — not a demo.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CARDS.map((card) => {
            const Icon = card.icon;
            const primary =
              preferRegister && card.secondaryHref
                ? { href: card.secondaryHref, label: card.secondaryLabel! }
                : { href: card.primaryHref, label: card.primaryLabel };
            const secondary =
              preferRegister && card.secondaryHref
                ? { href: card.primaryHref, label: card.primaryLabel }
                : card.secondaryHref
                  ? { href: card.secondaryHref, label: card.secondaryLabel! }
                  : null;

            return (
              <div
                key={card.id}
                className={cn(
                  'flex flex-col rounded-2xl border border-[#001B71]/08 bg-white p-6 shadow-sm',
                  'transition-shadow hover:shadow-md',
                )}
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF5FF] text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-foreground">{card.title}</h2>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <Button asChild variant="brand" className="w-full !rounded-full font-semibold">
                    <Link href={primary.href}>
                      {primary.label}
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                  {secondary ? (
                    <Button asChild variant="outline" className="w-full !rounded-full">
                      <Link href={secondary.href}>{secondary.label}</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] text-muted-foreground">
          Loading portal…
        </div>
      }
    >
      <PortalContent />
    </Suspense>
  );
}
