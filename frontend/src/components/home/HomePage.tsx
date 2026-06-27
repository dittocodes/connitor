'use client';

import { HomeFeatureGrid } from '@/components/home/HomeFeatureGrid';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeHero } from '@/components/home/HomeHero';
import { RolePortalGrid } from '@/components/home/RolePortalGrid';
import { SiteFooter } from '@/components/home/SiteFooter';
import { VisitorFlowTimeline } from '@/components/home/VisitorFlowTimeline';
import { VisitorJourneyPicker } from '@/components/home/VisitorJourneyPicker';

export function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50">
      <HomeHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <HomeHero />
        <VisitorJourneyPicker />
        <HomeFeatureGrid />
        <VisitorFlowTimeline />

        <section className="mt-14 rounded-2xl border border-teal-100/80 bg-slate-50/80 p-6 sm:mt-16 sm:p-8">
          <RolePortalGrid
            compact
            title="Hospital staff"
            description="Sign in with your work email and password to open your role dashboard."
          />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
