import Link from 'next/link';
import { Suspense } from 'react';
import { PreRegistrationWizardLoader } from '@/features/visitor-pre-registration/wizard/PreRegistrationWizardLoader';

export default function VisitorRegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-sm font-semibold text-teal-800">
            Connitor
          </Link>
          <Link href="/visitor/login" className="text-sm text-muted-foreground hover:text-foreground">
            Already registered? Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Suspense
          fallback={
            <p className="py-16 text-center text-muted-foreground">Loading registration form…</p>
          }
        >
          <PreRegistrationWizardLoader />
        </Suspense>
      </main>
    </div>
  );
}
