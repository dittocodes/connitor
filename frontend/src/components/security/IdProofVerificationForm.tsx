'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ID_PROOF_TYPES,
  SecurityAppointmentService,
  type IdProofType,
} from '@/lib/services/securityAppointmentService';

type Props = {
  visitId: string;
  idProofVerified?: boolean;
  onVerified: () => void;
};

export function IdProofVerificationForm({ visitId, idProofVerified, onVerified }: Props) {
  const [idProofType, setIdProofType] = React.useState<IdProofType>('AADHAAR');
  const [idProofNumber, setIdProofNumber] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  if (idProofVerified) {
    return (
      <Alert className="border-emerald-200 bg-emerald-50">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <AlertDescription className="text-emerald-800">
          ID proof verified. You may proceed with check-in.
        </AlertDescription>
      </Alert>
    );
  }

  const submit = async () => {
    if (!idProofNumber.trim()) {
      toast.error('Enter the ID document number');
      return;
    }
    setLoading(true);
    try {
      await SecurityAppointmentService.verifyIdProof(visitId, {
        idProofType,
        idProofNumber: idProofNumber.trim(),
      });
      toast.success('ID proof verified');
      onVerified();
    } catch {
      toast.error('Failed to verify ID proof');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
        <ShieldCheck className="h-4 w-4" />
        Appointment — verify visitor ID before check-in
      </div>
      <div>
        <Label>ID Type</Label>
        <Select value={idProofType} onValueChange={(v) => setIdProofType(v as IdProofType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ID_PROOF_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>ID Number</Label>
        <Input
          value={idProofNumber}
          onChange={(e) => setIdProofNumber(e.target.value)}
          placeholder="Enter document number"
        />
      </div>
      <Button
        type="button"
        className="w-full bg-amber-600 hover:bg-amber-700"
        onClick={submit}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
          </>
        ) : (
          'Verify ID Proof'
        )}
      </Button>
    </div>
  );
}
