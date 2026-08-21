'use client';

import { BookAppointmentWizard } from '@/features/book-appointment/BookAppointmentWizard';

export default function BookAppointmentPage() {
  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-lg">
        <BookAppointmentWizard />
      </div>
    </div>
  );
}
