// app/public-qr-visitor-form/page.tsx
import { Suspense } from 'react';
import PublicQRVisitorForm from '@/components/visitors/PublicQRVisitorForm';
import { Skeleton } from '@/components/ui/skeleton';

export default function PublicQRVisitorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-muted/40 p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
              <Skeleton className="h-12 w-12 mx-auto" />
              <Skeleton className="h-8 w-3/4 mx-auto" />
              <Skeleton className="h-4 w-1/2 mx-auto" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <PublicQRVisitorForm />
    </Suspense>
  );
}
