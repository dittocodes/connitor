'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useAuthSession } from '@/hooks/useAuthSession';
import {
  AttendantPassService,
  type AttendantAdmission,
  type AttendantPassRow,
  type AttendantRow,
  type VisitSlotRow,
} from '@/lib/services/attendantPassService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AttendantPassBranchLinks } from '@/features/attendant-passes/AttendantPassBranchLinks';

type Tab = 'admissions' | 'attendants' | 'passes' | 'slots';

export default function AttendantPassesPage(): React.ReactElement {
  const user = useAuthSession<{ branchId?: string }>();
  const branchId = user?.branchId;
  const [tab, setTab] = React.useState<Tab>('admissions');
  const [admissions, setAdmissions] = React.useState<AttendantAdmission[]>([]);
  const [attendants, setAttendants] = React.useState<AttendantRow[]>([]);
  const [passes, setPasses] = React.useState<AttendantPassRow[]>([]);
  const [visitSlots, setVisitSlots] = React.useState<VisitSlotRow[]>([]);
  const [defaultWindow, setDefaultWindow] = React.useState<{
    startTime: string;
    endTime: string;
    label?: string;
  }>({ startTime: '11:00', endTime: '16:00' });
  const [loading, setLoading] = React.useState(false);

  const [mrn, setMrn] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [patientPhone, setPatientPhone] = React.useState('');
  const [wardName, setWardName] = React.useState('');
  const [roomNumber, setRoomNumber] = React.useState('');
  const [bedNumber, setBedNumber] = React.useState('');

  const [admissionId, setAdmissionId] = React.useState('');
  const [attName, setAttName] = React.useState('');
  const [attEmail, setAttEmail] = React.useState('');
  const [attPhone, setAttPhone] = React.useState('');
  const [relationship, setRelationship] = React.useState('');

  const [slotAdmissionId, setSlotAdmissionId] = React.useState('');
  const [slotStart, setSlotStart] = React.useState('17:00');
  const [slotEnd, setSlotEnd] = React.useState('19:00');
  const [slotDate, setSlotDate] = React.useState('');
  const [slotLabel, setSlotLabel] = React.useState('');
  const [slotEveryDay, setSlotEveryDay] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!branchId) return;
    try {
      const [a, t, p, slots] = await Promise.all([
        AttendantPassService.listAdmissions(branchId),
        AttendantPassService.listAttendants(branchId),
        AttendantPassService.listPasses(branchId),
        AttendantPassService.listVisitSlots(branchId),
      ]);
      setAdmissions(a);
      setAttendants(t);
      setPasses(p);
      setVisitSlots(slots.items);
      if (slots.defaultWindow) setDefaultWindow(slots.defaultWindow);
    } catch {
      toast.error('Could not load attendant data');
    }
  }, [branchId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAdmission = async () => {
    if (!branchId || !mrn.trim() || !firstName.trim() || !lastName.trim()) {
      toast.error('MRN and patient name are required');
      return;
    }
    setLoading(true);
    try {
      const patient = await AttendantPassService.createPatient({
        branchId,
        mrn: mrn.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: patientPhone.trim() || undefined,
      });
      await AttendantPassService.createAdmission({
        patientId: patient.id,
        branchId,
        wardName: wardName.trim() || undefined,
        roomNumber: roomNumber.trim() || undefined,
        bedNumber: bedNumber.trim() || undefined,
      });
      toast.success('Patient admitted');
      setMrn('');
      setFirstName('');
      setLastName('');
      setPatientPhone('');
      setWardName('');
      setRoomNumber('');
      setBedNumber('');
      await refresh();
    } catch {
      toast.error('Failed to create admission');
    } finally {
      setLoading(false);
    }
  };

  const registerAttendant = async () => {
    if (!admissionId || !attName.trim() || !attEmail.trim() || !attPhone.trim()) {
      toast.error('Admission, name, email, and phone are required');
      return;
    }
    setLoading(true);
    try {
      await AttendantPassService.registerAttendant({
        admissionId,
        name: attName.trim(),
        email: attEmail.trim(),
        phone: attPhone.trim(),
        relationship: relationship.trim() || undefined,
      });
      toast.success('Attendant registered (pending approval)');
      setAttName('');
      setAttEmail('');
      setAttPhone('');
      setRelationship('');
      await refresh();
      setTab('attendants');
    } catch {
      toast.error('Failed to register attendant');
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id: string) => {
    try {
      await AttendantPassService.approveAttendant(id);
      toast.success('Attendant approved');
      await refresh();
    } catch {
      toast.error('Approve failed');
    }
  };

  const issue = async (attendant: AttendantRow) => {
    const admission = attendant.admission ?? admissions.find((a) => a.id === attendant.admissionId);
    const hasActive = admission?.hasActivePass;
    let revokeExisting = false;
    if (hasActive) {
      const ok = window.confirm(
        'Another ACTIVE pass exists for this patient. Revoke it and issue this pass?',
      );
      if (!ok) return;
      revokeExisting = true;
    }
    try {
      const issued = await AttendantPassService.issuePass(attendant.id, revokeExisting);
      if (issued.emailSent) {
        toast.success('Pass issued — QR emailed to attendant');
      } else {
        toast.success('Pass issued — QR email was skipped (check SMTP / attendant email)');
      }
      await refresh();
      setTab('passes');
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? '')
          : '';
      toast.error(msg || 'Issue failed');
    }
  };

  const revoke = async (passId: string) => {
    try {
      await AttendantPassService.revokePass(passId);
      toast.success('Pass revoked');
      await refresh();
    } catch {
      toast.error('Revoke failed');
    }
  };

  const addVisitSlot = async () => {
    if (!slotAdmissionId || !slotStart || !slotEnd) {
      toast.error('Patient, start, and end time are required');
      return;
    }
    if (!slotEveryDay && !slotDate) {
      toast.error('Pick a date, or mark the slot as every day');
      return;
    }
    setLoading(true);
    try {
      await AttendantPassService.createVisitSlot({
        admissionId: slotAdmissionId,
        startTime: slotStart,
        endTime: slotEnd,
        visitDate: slotEveryDay ? undefined : slotDate,
        label: slotLabel.trim() || undefined,
      });
      toast.success('Extra visiting slot added for this patient');
      setSlotLabel('');
      await refresh();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? '')
          : '';
      toast.error(msg || 'Could not add visit slot');
    } finally {
      setLoading(false);
    }
  };

  const removeVisitSlot = async (slotId: string) => {
    try {
      await AttendantPassService.deleteVisitSlot(slotId);
      toast.success('Visit slot removed');
      await refresh();
    } catch {
      toast.error('Could not remove slot');
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Attendant Passes</h1>
      </div>

      <AttendantPassBranchLinks branchId={branchId ?? null} />

      <Card className="border-teal-100 bg-teal-50/40">
        <CardContent className="py-4 text-sm">
          <p className="font-medium text-teal-900">
            Default visiting hours (all patients, every day): {defaultWindow.startTime}–{defaultWindow.endTime} IST
          </p>
          <p className="text-muted-foreground mt-1">
            Use the Visit slots tab to add extra hours for a specific patient (for example evenings).
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 text-sm">
        {(['admissions', 'attendants', 'passes', 'slots'] as Tab[]).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? 'default' : 'outline'}
            onClick={() => setTab(t)}
          >
            {t === 'admissions'
              ? 'Admissions'
              : t === 'attendants'
                ? 'Attendants'
                : t === 'passes'
                  ? 'Passes'
                  : 'Visit slots'}
          </Button>
        ))}
      </div>

      {tab === 'admissions' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Admit patient</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>MRN</Label>
                <Input value={mrn} onChange={(e) => setMrn(e.target.value)} />
              </div>
              <div>
                <Label>Phone (optional)</Label>
                <Input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
              </div>
              <div>
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div>
                <Label>Ward</Label>
                <Input value={wardName} onChange={(e) => setWardName(e.target.value)} />
              </div>
              <div>
                <Label>Room</Label>
                <Input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
              </div>
              <div>
                <Label>Bed</Label>
                <Input value={bedNumber} onChange={(e) => setBedNumber(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button disabled={loading || !branchId} onClick={() => void createAdmission()}>
                  Create admission
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active admissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {admissions.length === 0 && (
                <p className="text-muted-foreground">No active admissions.</p>
              )}
              {admissions.map((a) => (
                <div key={a.id} className="rounded border p-3 flex justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.patient?.name ?? 'Patient'}</p>
                    <p className="text-muted-foreground">
                      MRN {a.patient?.mrn} · {a.wardName ?? '—'} / Room {a.roomNumber ?? '—'}
                      {a.hasActivePass ? ' · Active pass held' : ''}
                    </p>
                    <p className="text-xs text-teal-800 mt-1">
                      Visits: {a.visitingHours?.summary ?? `${defaultWindow.startTime}–${defaultWindow.endTime} (default)`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdmissionId(a.id);
                        setTab('attendants');
                      }}
                    >
                      Register visitor
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSlotAdmissionId(a.id);
                        setTab('slots');
                      }}
                    >
                      Add visit slot
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'attendants' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Register family visitor</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Admission</Label>
                <Select value={admissionId} onValueChange={setAdmissionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select admission" />
                  </SelectTrigger>
                  <SelectContent>
                    {admissions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.patient?.name} ({a.patient?.mrn})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Name</Label>
                <Input value={attName} onChange={(e) => setAttName(e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={attEmail}
                  onChange={(e) => setAttEmail(e.target.value)}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={attPhone} onChange={(e) => setAttPhone(e.target.value)} />
              </div>
              <div>
                <Label>Relationship</Label>
                <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button disabled={loading} onClick={() => void registerAttendant()}>
                  Submit for approval
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendant requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {attendants.map((a) => (
                <div key={a.id} className="rounded border p-3 flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {a.name} · {a.status}
                    </p>
                    <p className="text-muted-foreground">
                      {a.email} · {a.phone}
                      {a.relationship ? ` · ${a.relationship}` : ''}
                    </p>
                    <p className="text-muted-foreground">
                      Patient: {a.admission?.patient?.name ?? '—'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {a.status === 'PENDING' && (
                      <Button size="sm" onClick={() => void approve(a.id)}>
                        Approve
                      </Button>
                    )}
                    {a.status === 'APPROVED' && (
                      <Button size="sm" onClick={() => void issue(a)}>
                        Issue pass
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'passes' && (
        <Card>
          <CardHeader>
            <CardTitle>Passes</CardTitle>
            <p className="text-sm text-muted-foreground">
              Only one ACTIVE pass per admission. QR is emailed to the attendant.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {passes.length === 0 && <p className="text-muted-foreground">No passes yet.</p>}
            {passes.map((p) => (
              <div key={p.id} className="rounded border p-3 flex justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {p.passNumber} — {p.status}
                    {p.isInside ? ' · Inside' : p.exitedAt ? ' · Checked out' : ''}
                  </p>
                  <p className="text-muted-foreground">
                    {p.attendant?.name} ({p.attendant?.email}) · Patient{' '}
                    {p.attendant?.admission?.patient?.name ?? '—'}
                  </p>
                  {(p.enteredAt || p.exitedAt || p.durationMinutes != null) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {p.enteredAt ? `In ${p.enteredAt}` : ''}
                      {p.exitedAt ? ` · Out ${p.exitedAt}` : ''}
                      {p.durationMinutes != null ? ` · ${p.durationMinutes} min` : ''}
                    </p>
                  )}
                </div>
                {p.status === 'ACTIVE' && (
                  <Button size="sm" variant="outline" onClick={() => void revoke(p.id)}>
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'slots' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add extra visiting slot for a patient</CardTitle>
              <p className="text-sm text-muted-foreground">
                Everyone already has {defaultWindow.startTime}–{defaultWindow.endTime} IST daily.
                Add another window when a patient needs extra visiting time.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Patient admission</Label>
                <Select value={slotAdmissionId} onValueChange={setSlotAdmissionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {admissions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.patient?.name} ({a.patient?.mrn})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start time</Label>
                <Input type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
              </div>
              <div>
                <Label>End time</Label>
                <Input type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="slot-every-day"
                  type="checkbox"
                  checked={slotEveryDay}
                  onChange={(e) => setSlotEveryDay(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="slot-every-day" className="font-normal">
                  Repeat every day while patient is admitted
                </Label>
              </div>
              {!slotEveryDay && (
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
                </div>
              )}
              <div className={slotEveryDay ? 'sm:col-span-2' : ''}>
                <Label>Label (optional)</Label>
                <Input
                  value={slotLabel}
                  onChange={(e) => setSlotLabel(e.target.value)}
                  placeholder="e.g. Evening visit"
                />
              </div>
              <div className="sm:col-span-2">
                <Button disabled={loading || !branchId} onClick={() => void addVisitSlot()}>
                  Add visit slot
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Extra slots</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {visitSlots.length === 0 && (
                <p className="text-muted-foreground">
                  No extra slots yet. Default {defaultWindow.startTime}–{defaultWindow.endTime} applies to all patients.
                </p>
              )}
              {visitSlots.map((s) => (
                <div key={s.id} className="rounded border p-3 flex justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {s.patient?.name ?? 'Patient'} · {s.startTime}–{s.endTime}
                    </p>
                    <p className="text-muted-foreground">
                      {s.everyDay || !s.visitDate ? 'Every day' : s.visitDate}
                      {s.label ? ` · ${s.label}` : ''}
                      {s.wardName ? ` · ${s.wardName}` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void removeVisitSlot(s.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
