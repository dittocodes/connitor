'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50">
      <header className="border-b border-teal-100/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/ConnInter.png"
              alt="Connitor"
              width={140}
              height={44}
              className="h-9 w-auto sm:h-10"
              priority
            />
          </Link>
          <Button asChild variant="ghost" size="sm" className="text-teal-800">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Link>
          </Button>
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-65px)] items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}
