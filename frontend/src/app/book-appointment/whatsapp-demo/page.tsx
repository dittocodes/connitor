'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, MessageCircle, RefreshCw } from 'lucide-react';
import { WhatsAppApprovalSimulator } from '@/components/whatsapp/WhatsAppApprovalSimulator';
import { AppointmentService } from '@/lib/services/appointmentService';
import {
  WhatsAppSimulationService,
  type WhatsAppSimulationContext,
} from '@/lib/services/whatsappSimulationService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STATUS_LABELS: Record<string, string> = {
  REQUEST_SENT: 'Awaiting Doctor Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CHECKED_IN: 'Checked In',
  CHECKED_OUT: 'Completed',
};

const TIMELINE = [
  { key: 'booked', label: 'Appointment booked' },
  { key: 'awaiting', label: 'Doctor notified on WhatsApp' },
  { key: 'decided', label: 'Doctor approved or rejected' },
] as const;

function timelineStep(status: string): number {
  if (status === 'REQUEST_SENT') return 1;
  if (status === 'APPROVED' || status === 'REJECTED') return 2;
  return 3;
}

export default function WhatsAppDemoPage() {
  const searchParams = useSearchParams();
  const [bookingId, setBookingId] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [context, setContext] = React.useState<WhatsAppSimulationContext | null>(null);
  const [visitStatus, setVisitStatus] = React.useState<string | null>(null);
  const [doctorReply, setDoctorReply] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const loadDemo = React.useCallback(async (id: string, visitorPhone: string) => {
    setLoading(true);
    setError('');
    setDoctorReply(null);
    try {
      const [sim, status] = await Promise.all([
        WhatsAppSimulationService.getSimulationContext(id, visitorPhone),
        AppointmentService.getBookingStatus(id, visitorPhone),
      ]);
      setContext(sim);
      setVisitStatus(status.status);
    } catch {
      setContext(null);
      setVisitStatus(null);
      setError(
        'Could not load simulation. Check booking ID and phone, or ensure the API is running in dev/demo mode.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const id = searchParams.get('bookingId') ?? '';
    const p = searchParams.get('phone') ?? '';
    if (id) setBookingId(id);
    if (p) setPhone(p);
    if (id && p.length === 10) {
      void loadDemo(id, p);
    }
  }, [searchParams, loadDemo]);

  React.useEffect(() => {
    if (!bookingId || phone.length !== 10 || visitStatus !== 'REQUEST_SENT') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      AppointmentService.getBookingStatus(bookingId, phone)
        .then((result) => setVisitStatus(result.status))
        .catch(() => undefined);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [bookingId, phone, visitStatus]);

  const handleLookup = () => {
    if (!bookingId || phone.length !== 10) return;
    void loadDemo(bookingId.trim(), phone.trim());
  };

  const handleReply = async (action: 'approve' | 'reject') => {
    if (!context || !context.doctorPhone || !context.approvalCode) return;
    setSubmitting(true);
    setError('');
    try {
      const code = context.approvalCode;
      const result = await WhatsAppSimulationService.simulateDoctorReply({
        fromPhone: context.doctorPhone,
        buttonId: context.supportsInteractiveButtons
          ? `${action === 'approve' ? 'yes' : 'no'}_${code}`
          : undefined,
        body: context.supportsInteractiveButtons
          ? undefined
          : `${action === 'approve' ? 'YES' : 'NO'} ${code}`,
      });
      setDoctorReply(result.message);
      const status = await AppointmentService.getBookingStatus(bookingId, phone);
      setVisitStatus(status.status);
      const refreshed = await WhatsAppSimulationService.getSimulationContext(bookingId, phone);
      setContext(refreshed);
    } catch {
      setError('Failed to simulate doctor reply. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeStep = visitStatus ? timelineStep(visitStatus) : -1;
  const statusLabel = visitStatus ? (STATUS_LABELS[visitStatus] ?? visitStatus) : '—';
  const isPending = visitStatus === 'REQUEST_SENT';

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <MessageCircle className="h-6 w-6 text-emerald-600" />
              WhatsApp Approval Demo
            </h1>
            <p className="text-sm text-muted-foreground">
              Live simulation — book an appointment, then act as the doctor on WhatsApp.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/book-appointment">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Book appointment
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load a booking</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="bookingId">Booking ID</Label>
              <Input
                id="bookingId"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                placeholder="UUID from booking confirmation"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="phone">Visitor phone (10 digits)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={10}
              />
            </div>
            <Button onClick={handleLookup} disabled={loading || !bookingId || phone.length !== 10}>
              {loading ? 'Loading...' : 'Load demo'}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {context && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>Visitor view</span>
                  <Badge variant={isPending ? 'secondary' : 'default'}>{statusLabel}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Visitor</dt>
                    <dd className="font-medium">{context.visitorName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Doctor</dt>
                    <dd className="font-medium">{context.doctorName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Appointment</dt>
                    <dd className="text-right font-medium">{context.appointmentLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Booking ID</dt>
                    <dd className="truncate font-mono text-xs">{context.bookingId}</dd>
                  </div>
                </dl>

                <ol className="space-y-3 border-t pt-4">
                  {TIMELINE.map((step, index) => {
                    const done = activeStep >= index;
                    const current = activeStep === index;
                    return (
                      <li key={step.key} className="flex items-start gap-3 text-sm">
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            done
                              ? 'bg-emerald-600 text-white'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className={current ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                          {step.label}
                          {current && isPending && (
                            <RefreshCw className="ml-1 inline h-3 w-3 animate-spin" />
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                <Button variant="outline" className="mt-auto w-full" asChild>
                  <Link href={`/book-appointment/status?bookingId=${bookingId}&phone=${phone}`}>
                    Open full status page
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Doctor WhatsApp (simulated)</p>
              <WhatsAppApprovalSimulator
                context={context}
                doctorReply={doctorReply}
                isSubmitting={submitting}
                disabled={!isPending}
                onApprove={() => void handleReply('approve')}
                onReject={() => void handleReply('reject')}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
