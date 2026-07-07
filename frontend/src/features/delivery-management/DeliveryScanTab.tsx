'use client';

import * as React from 'react';
import apiClient from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DeliveryScanTabProps {
  branchId: string;
}

export function DeliveryScanTab({ branchId }: DeliveryScanTabProps): React.ReactElement {
  const [qrPayload, setQrPayload] = React.useState('');
  const [signature, setSignature] = React.useState('');
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null);
  const [queue, setQueue] = React.useState<{
    walkInVisits: Array<Record<string, unknown>>;
    vendorDeliveries: Array<Record<string, unknown>>;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadQueue = React.useCallback(async () => {
    try {
      const res = await apiClient.get('/api/security/queue', { params: { branchId } });
      setQueue(res.data);
    } catch {
      setQueue({ walkInVisits: [], vendorDeliveries: [] });
    }
  }, [branchId]);

  React.useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleScan = async () => {
    setError(null);
    let payload = qrPayload;
    let sig = signature;
    try {
      const parsed = JSON.parse(qrPayload) as { qrPayload?: string; signature?: string };
      if (parsed.qrPayload && parsed.signature) {
        payload = parsed.qrPayload;
        sig = parsed.signature;
      }
    } catch {
      // use manual fields
    }
    try {
      const res = await apiClient.post('/api/delivery/security/scan-qr', {
        qrPayload: payload,
        signature: sig,
      });
      setResult(res.data);
      void loadQueue();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Scan vendor delivery QR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="QR payload"
            value={qrPayload}
            onChange={(e) => setQrPayload(e.target.value)}
          />
          <Input
            placeholder="Signature"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
          />
          <Button type="button" onClick={() => void handleScan()}>
            Validate QR
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && (
            <pre className="text-xs bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unified queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">Walk-in visits ({queue?.walkInVisits?.length ?? 0})</p>
          <ul className="list-disc pl-5">
            {(queue?.walkInVisits ?? []).slice(0, 5).map((v) => (
              <li key={String(v.id)}>
                {String(v.visitCategory)} — {String(v.platform ?? v.status)}
              </li>
            ))}
          </ul>
          <p className="font-medium mt-3">Vendor deliveries ({queue?.vendorDeliveries?.length ?? 0})</p>
          <ul className="list-disc pl-5">
            {(queue?.vendorDeliveries ?? []).slice(0, 5).map((d) => (
              <li key={String(d.id)}>
                {String(d.deliveryNumber)} — {String(d.goodsType ?? d.status)} ·{' '}
                {String(d.agentName ?? '')}
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadQueue()}>
            Refresh
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
