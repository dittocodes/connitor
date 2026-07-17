'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { AttendantPassService } from '@/lib/services/attendantPassService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AttendantPassScanTabProps {
  branchId: string;
}

export function AttendantPassScanTab({ branchId }: AttendantPassScanTabProps): React.ReactElement {
  const [qrText, setQrText] = React.useState('');
  const [signature, setSignature] = React.useState('');
  const [govtIdType, setGovtIdType] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleScan = async () => {
    setError(null);
    setResult(null);
    let payload = qrText.trim();
    let sig = signature.trim();
    try {
      const parsed = JSON.parse(qrText) as { qrPayload?: string; signature?: string };
      if (parsed.qrPayload && parsed.signature) {
        payload = parsed.qrPayload;
        sig = parsed.signature;
      }
    } catch {
      // manual fields
    }
    if (!payload || !sig) {
      setError('QR payload and signature are required');
      return;
    }
    if (!file) {
      setError('Government ID photo is required');
      return;
    }

    const form = new FormData();
    form.append('qrPayload', payload);
    form.append('signature', sig);
    form.append('govtIdImage', file);
    form.append('scanType', 'ENTRY');
    if (govtIdType.trim()) form.append('govtIdType', govtIdType.trim());

    setLoading(true);
    try {
      const res = await AttendantPassService.scanPass(form);
      setResult(res);
      toast.success('Pass validated');
    } catch (e: unknown) {
      const detail =
        typeof e === 'object' && e && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? '')
          : '';
      setError(detail || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Scan attendant visit pass</CardTitle>
          <p className="text-sm text-muted-foreground">
            Branch {branchId}. Scan the emailed QR and capture the visitor&apos;s government ID.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>QR (JSON or payload)</Label>
            <Input
              placeholder='Paste QR JSON {"qrPayload":"...","signature":"..."} or payload'
              value={qrText}
              onChange={(e) => setQrText(e.target.value)}
            />
          </div>
          <div>
            <Label>Signature (if not in JSON)</Label>
            <Input value={signature} onChange={(e) => setSignature(e.target.value)} />
          </div>
          <div>
            <Label>ID type (optional)</Label>
            <Input
              placeholder="Aadhaar / Driving Licence / Passport"
              value={govtIdType}
              onChange={(e) => setGovtIdType(e.target.value)}
            />
          </div>
          <div>
            <Label>Government ID photo</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button disabled={loading} onClick={() => void handleScan()}>
            {loading ? 'Validating…' : 'Validate & capture ID'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && (
            <pre className="text-xs bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
