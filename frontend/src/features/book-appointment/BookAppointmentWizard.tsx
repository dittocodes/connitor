'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, MapPin, Stethoscope, Clock, Languages } from 'lucide-react';
import {
  AppointmentService,
  type DoctorSlot,
  type PublicDoctor,
} from '@/lib/services/appointmentService';
import { todayIstDateIso } from '@/lib/datetime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export interface BookAppointmentWizardProps {
  initialBranchId?: string;
  initialBranchName?: string;
  onSuccess?: (result: { bookingId: string; message: string; phone: string }) => void;
  showHeaderLinks?: boolean;
  title?: string;
  className?: string;
}

function DoctorDetailCard({ doctor }: { doctor: PublicDoctor }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800">
          <Stethoscope className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-base">{doctor.name}</p>
          {doctor.qualification && (
            <p className="text-muted-foreground">{doctor.qualification}</p>
          )}
          {doctor.experienceYears && (
            <p className="text-muted-foreground">{doctor.experienceYears}+ years experience</p>
          )}
        </div>
      </div>
      <div className="grid gap-1.5 text-muted-foreground">
        {doctor.departmentName && (
          <p>
            <span className="font-medium text-foreground">Department:</span> {doctor.departmentName}
            {doctor.subDepartmentName ? ` · ${doctor.subDepartmentName}` : ''}
          </p>
        )}
        {doctor.location && (
          <p className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {doctor.location}
            {doctor.branchCity ? `, ${doctor.branchCity}` : ''}
          </p>
        )}
        {doctor.languages?.length ? (
          <p className="flex items-center gap-1">
            <Languages className="h-3.5 w-3.5 shrink-0" />
            {doctor.languages.join(', ')}
          </p>
        ) : null}
      </div>
      {doctor.consultationModes?.length ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {doctor.consultationModes.map((mode) => (
            <Badge key={mode} variant="secondary" className="text-xs">
              {mode === 'ONLINE' ? 'Online consult' : 'In-person'}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BookAppointmentWizard({
  initialBranchId,
  initialBranchName,
  onSuccess,
  showHeaderLinks = true,
  title = 'Book Doctor Appointment',
  className,
}: BookAppointmentWizardProps) {
  const minStep: Step = initialBranchId ? 2 : 1;
  const totalSteps = initialBranchId ? 5 : 6;

  const [step, setStep] = React.useState<Step>(minStep);
  const [hospitals, setHospitals] = React.useState<{ id: string; name: string; city: string }[]>([]);
  const [departments, setDepartments] = React.useState<{ id: string; name: string }[]>([]);
  const [subDepartments, setSubDepartments] = React.useState<{ id: string; name: string }[]>([]);
  const [doctors, setDoctors] = React.useState<PublicDoctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = React.useState<PublicDoctor | null>(null);
  const [slots, setSlots] = React.useState<DoctorSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [branchId, setBranchId] = React.useState(initialBranchId ?? '');
  const [branchName, setBranchName] = React.useState(initialBranchName ?? '');
  const [departmentId, setDepartmentId] = React.useState('');
  const [subDepartmentId, setSubDepartmentId] = React.useState('');
  const [doctorId, setDoctorId] = React.useState('');
  const [slotId, setSlotId] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [appointmentDate, setAppointmentDate] = React.useState(todayIstDateIso());
  const [purpose, setPurpose] = React.useState('');
  const [appointmentMode, setAppointmentMode] = React.useState<'IN_PERSON' | 'ONLINE'>('IN_PERSON');
  const [result, setResult] = React.useState<{ bookingId: string; message: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loadingHospitals, setLoadingHospitals] = React.useState(!initialBranchId);
  const [loadingDepartments, setLoadingDepartments] = React.useState(!!initialBranchId);

  const displayStep = initialBranchId ? step - 1 : step;

  React.useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('visitorAuthToken') : null;
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
      if (payload.sub && !String(payload.sub).includes('@')) {
        import('@/features/visitor-pre-registration/api/visitorAccountService').then(
          ({ VisitorAccountApi }) => {
            VisitorAccountApi.getMyProfile(token).then((profile) => {
              const parts = profile.fullName?.split(' ') ?? [];
              setFirstName(profile.firstName ?? parts[0] ?? '');
              setLastName(profile.lastName ?? parts.slice(1).join(' ') ?? '');
              setPhone(profile.phone ?? '');
              setEmail(profile.email ?? '');
            }).catch(() => undefined);
          },
        );
      }
    } catch {
      /* legacy token */
    }
  }, []);

  React.useEffect(() => {
    if (initialBranchId) return;
    setLoadingHospitals(true);
    AppointmentService.listPublicHospitals()
      .then((list) => {
        setHospitals(list);
        if (!list.length) {
          setError(
            'No hospitals are available for online booking yet. Ensure the backend is running and booking data is seeded.',
          );
        }
      })
      .catch(() => setError('Failed to load hospitals. Is the backend running on port 8001?'))
      .finally(() => setLoadingHospitals(false));
  }, [initialBranchId]);

  React.useEffect(() => {
    if (!initialBranchId) return;
    setLoadingDepartments(true);
    AppointmentService.listPublicDepartments(initialBranchId)
      .then((depts) => {
        setDepartments(depts);
        if (!depts.length) {
          setError('No departments are configured for this hospital yet.');
        }
      })
      .catch(() => setError('Failed to load departments. Please try again.'))
      .finally(() => setLoadingDepartments(false));
  }, [initialBranchId]);

  React.useEffect(() => {
    if (!doctorId || !appointmentDate || step < 5) return;
    setLoadingSlots(true);
    setSlotId('');
    AppointmentService.listDoctorSlots(doctorId, appointmentDate)
      .then(setSlots)
      .catch(() => {
        setSlots([]);
        setError('Could not load available time slots.');
      })
      .finally(() => setLoadingSlots(false));
  }, [doctorId, appointmentDate, step]);

  const selectHospital = async (id: string) => {
    const hospital = hospitals.find((h) => h.id === id);
    setBranchId(id);
    setBranchName(hospital?.name ?? '');
    setDepartmentId('');
    setSubDepartmentId('');
    setDoctorId('');
    setSelectedDoctor(null);
    setError('');
    try {
      const depts = await AppointmentService.listPublicDepartments(id);
      setDepartments(depts);
      if (!depts.length) {
        setError('No departments are configured for this hospital yet. Please try another location or contact the hospital.');
      }
      setStep(2);
    } catch {
      setError('Failed to load departments. Please try again.');
    }
  };

  const selectDepartment = async (id: string) => {
    setDepartmentId(id);
    setSubDepartmentId('');
    setDoctorId('');
    setSelectedDoctor(null);
    setError('');
    try {
      const subs = await AppointmentService.listPublicSubDepartments(id);
      setSubDepartments(subs);
      if (!subs.length) {
        setError('No sections available in this department yet.');
      }
      setStep(3);
    } catch {
      setError('Failed to load sections. Please try again.');
    }
  };

  const selectSubDepartment = async (id: string) => {
    setSubDepartmentId(id);
    setDoctorId('');
    setSelectedDoctor(null);
    setError('');
    try {
      const docs = await AppointmentService.listPublicDoctors(id);
      setDoctors(docs);
      if (!docs.length) {
        setError('No doctors available in this section yet.');
      }
      setStep(4);
    } catch {
      setError('Failed to load doctors. Please try again.');
    }
  };

  const selectDoctor = async (doctor: PublicDoctor) => {
    setDoctorId(doctor.id);
    setSlotId('');
    setError('');
    try {
      const detail = await AppointmentService.getPublicDoctor(doctor.id);
      setSelectedDoctor(detail);
    } catch {
      setSelectedDoctor(doctor);
    }
    setStep(5);
  };

  const goBack = () => {
    if (step > minStep && step < 6) setStep((step - 1) as Step);
  };

  const selectedSlot = slots.find((s) => s.id === slotId);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (phone.length !== 10 || !purpose.trim() || !slotId || !normalizedEmail.includes('@')) {
      setError('Please fill in all required fields, select a time slot, and use a valid 10-digit phone and email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await AppointmentService.book({
        branchId,
        departmentId,
        subDepartmentId,
        doctorId,
        firstName,
        lastName,
        phone,
        email: normalizedEmail,
        slotId,
        appointmentDate: selectedSlot?.slotStart,
        purpose,
        appointmentMode,
      });
      const bookingResult = { bookingId: res.bookingId, message: res.message };
      setResult(bookingResult);
      setStep(6);
      onSuccess?.({ ...bookingResult, phone });
    } catch {
      setError('Booking failed. The slot may have been taken — pick another time and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {step > minStep && step < 6 ? (
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        ) : (
          <span />
        )}
        {showHeaderLinks && (
          <div className="flex items-center gap-1">
            <Button variant="link" size="sm" asChild>
              <Link href="/book-appointment/how-it-works">How it works</Link>
            </Button>
            <Button variant="link" size="sm" asChild>
              <Link href="/book-appointment/status">Check booking status</Link>
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {step < 6 && (
            <p className="text-sm text-muted-foreground">
              Step {displayStep} of {totalSteps}
            </p>
          )}
          {initialBranchId && branchName && step < 6 && (
            <p className="text-sm text-teal-800 font-medium">{branchName}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          {step === 1 && (
            <div className="space-y-2">
              <Label>Select Hospital Location</Label>
              {loadingHospitals && (
                <p className="text-sm text-muted-foreground">Loading locations...</p>
              )}
              {!loadingHospitals && hospitals.length === 0 && !error && (
                <p className="text-sm text-muted-foreground">No hospitals available for booking.</p>
              )}
              {hospitals.map((h) => (
                <Button
                  key={h.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => selectHospital(h.id)}
                >
                  {h.name} — {h.city}
                </Button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Label>Select Department</Label>
              {loadingDepartments && (
                <p className="text-sm text-muted-foreground">Loading departments...</p>
              )}
              {!loadingDepartments && departments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No departments available for this hospital location.
                </p>
              )}
              {departments.map((d) => (
                <Button
                  key={d.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => selectDepartment(d.id)}
                >
                  {d.name}
                </Button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              <Label>Select Section</Label>
              {subDepartments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No sections available in this department.
                </p>
              )}
              {subDepartments.map((s) => (
                <Button
                  key={s.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => selectSubDepartment(s.id)}
                >
                  {s.name}
                </Button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <Label>Select Doctor</Label>
              {doctors.length === 0 && (
                <p className="text-sm text-muted-foreground">No doctors available in this section.</p>
              )}
              {doctors.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="w-full rounded-lg border bg-card p-4 text-left transition hover:border-teal-500 hover:bg-teal-50/50"
                  onClick={() => selectDoctor(d)}
                >
                  <p className="font-medium">{d.name}</p>
                  {d.departmentName && (
                    <p className="text-sm text-muted-foreground mt-0.5">{d.departmentName}</p>
                  )}
                  {d.location && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {d.location}
                    </p>
                  )}
                  {d.qualification && (
                    <p className="text-xs text-muted-foreground mt-1">{d.qualification}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {step === 5 && selectedDoctor && (
            <div className="space-y-4">
              <DoctorDetailCard doctor={selectedDoctor} />

              <div>
                <Label>First Name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
              <div>
                <Label>Phone (10 digits)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={10} required />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  placeholder="Required for dashboard login"
                />
              </div>

              <div>
                <Label>Appointment Date</Label>
                <Input
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  type="date"
                  min={todayIstDateIso()}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Available time slots
                </Label>
                {loadingSlots && (
                  <p className="text-sm text-muted-foreground">Loading slots…</p>
                )}
                {!loadingSlots && slots.length === 0 && (
                  <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                    No slots available on this date. Try another day or contact the hospital.
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <Button
                      key={slot.id}
                      type="button"
                      size="sm"
                      variant={slotId === slot.id ? 'default' : 'outline'}
                      className={cn('text-xs', slotId === slot.id && 'bg-teal-700')}
                      onClick={() => setSlotId(slot.id)}
                    >
                      {slot.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Purpose</Label>
                <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Visit type</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={appointmentMode === 'IN_PERSON' ? 'default' : 'outline'}
                    className="h-auto py-3 justify-start"
                    onClick={() => setAppointmentMode('IN_PERSON')}
                  >
                    <span className="text-left">
                      <span className="block font-medium">In-person</span>
                      <span className="block text-xs opacity-80">Visit the hospital with QR check-in</span>
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant={appointmentMode === 'ONLINE' ? 'default' : 'outline'}
                    className="h-auto py-3 justify-start"
                    onClick={() => setAppointmentMode('ONLINE')}
                  >
                    <span className="text-left">
                      <span className="block font-medium">Online consultation</span>
                      <span className="block text-xs opacity-80">Zoom link after doctor approval</span>
                    </span>
                  </Button>
                </div>
              </div>
              <Button className="w-full" onClick={submit} disabled={loading || !slotId}>
                {loading ? 'Booking...' : 'Confirm Booking'}
              </Button>
            </div>
          )}

          {step === 6 && result && (
            <div className="space-y-4 text-center">
              <p className="font-medium text-green-600">Booking Confirmed</p>
              <p className="text-sm">{result.message}</p>
              <p className="text-sm text-muted-foreground break-all">Booking ID: {result.bookingId}</p>
              <p className="text-xs text-muted-foreground">
                Save your booking ID. You will receive approval once the doctor reviews your request.
              </p>
              <Button variant="outline" asChild className="w-full">
                <Link href={`/book-appointment/status?bookingId=${result.bookingId}&phone=${phone}`}>
                  Track this booking
                </Link>
              </Button>
              <Button asChild className="w-full">
                <Link
                  href={`/book-appointment/whatsapp-demo?bookingId=${result.bookingId}&phone=${phone}`}
                >
                  See WhatsApp approval demo
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
