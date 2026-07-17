'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AttendantPassService } from '@/lib/services/attendantPassService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ApplyForm(): React.ReactElement {
  const params = useSearchParams();
  const [branchId, setBranchId] = React.useState(params.get('branchId') ?? '');
  const [mrn, setMrn] = React.useState('');
  const [lookup, setLookup] = React.useState<{
    admissionId: string;
    patientFirstName: string;
    wardName?: string | null;
    roomNumber?: string | null;
    hasActivePass: boolean;
  } | null>(null);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [relationship, setRelationship] = React.useState('');
  const [done, setDone] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const doLookup = async () => {
    if (!branchId.trim() || !mrn.trim()) {
      toast.error('Hospital branch and patient MRN are required');
      return;
    }
    setLoading(true);
    try {
      const res = await AttendantPassService.lookupAdmission(branchId.trim(), mrn.trim());
      setLookup(res);
      toast.success(`Found patient ${res.patientFirstName}`);
    } catch {
      setLookup(null);
      toast.error('No active admission found for this MRN');
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!lookup || !name.trim() || !email.trim() || !phone.trim()) {
      toast.error('Fill all required fields');
      return;
    }
    setLoading(true);
    try {
      await AttendantPassService.publicApply({
        admissionId: lookup.admissionId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        relationship: relationship.trim() || undefined,
      });
      setDone(true);
    } catch {
      toast.error('Could not submit request');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-8 space-y-3 text-center">
          <h2 className="text-xl font-semibold">Request submitted</h2>
          <p className="text-sm text-muted-foreground">
            Ward staff will review your request. When approved, your visit pass and QR code will be
            sent to your email. Bring a government ID to security.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Apply for visit pass</h1>
        <p className="text-sm text-muted-foreground">
          Only one family member may hold an active pass at a time. Submit a request to visit an
          admitted patient.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Find patient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Hospital branch ID</Label>
            <Input
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              placeholder="Provided by hospital"
            />
          </div>
          <div>
            <Label>Patient MRN</Label>
            <Input value={mrn} onChange={(e) => setMrn(e.target.value)} />
          </div>
          <Button disabled={loading} onClick={() => void doLookup()}>
            Look up
          </Button>
          {lookup && (
            <p className="text-sm text-teal-800 bg-teal-50 rounded p-3">
              Visiting <strong>{lookup.patientFirstName}</strong>
              {lookup.wardName ? ` · ${lookup.wardName}` : ''}
              {lookup.roomNumber ? ` / Room ${lookup.roomNumber}` : ''}
              {lookup.hasActivePass
                ? ' — another visitor currently holds the active pass; ward must revoke it before yours is issued.'
                : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {lookup && (
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Email (pass QR will be sent here)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Relationship to patient</Label>
              <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} />
            </div>
            <Button disabled={loading} onClick={() => void submit()}>
              Submit request
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AttendantPassApplyPage(): React.ReactElement {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <React.Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ApplyForm />
      </React.Suspense>
    </main>
  );
}
