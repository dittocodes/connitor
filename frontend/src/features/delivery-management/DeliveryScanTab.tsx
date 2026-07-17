'use client';

import * as React from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeliveryStatusBadge } from '@/features/delivery-management/ui';
import { formatIstDateTime } from '@/lib/datetime';

interface DeliveryScanTabProps {
  branchId: string;
}

export function DeliveryScanTab({ branchId }: DeliveryScanTabProps): React.ReactElement {
  const [qrText, setQrText] = React.useState('');
  const [signature, setSignature] = React.useState('');
  const [delivery, setDelivery] = React.useState<Record<string, unknown> | null>(null);
  const [passNumber, setPassNumber] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [queue, setQueue] = React.useState<{
    walkInVisits: Array<Record<string, unknown>>;
    vendorDeliveries: Array<Record<string, unknown>>;
  } | null>(null);

  const loadQueue = React.useCallback(async () => {
    try {
      const res = await apiClient.get('/api/delivery/security/queue', { params: { branchId } });
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
    setPassNumber(null);
    let payload = qrText.trim();
    let sig = signature.trim();
    try {
      const parsed = JSON.parse(qrText) as { qrPayload?: string; signature?: string };
      if (parsed.qrPayload && parsed.signature) {
        payload = parsed.qrPayload;
        sig = parsed.signature;
      }
    } catch {
      // manual
    }
    if (!payload || !sig) {
      setError('QR payload and signature required');
      return;
    }
    try {
      const res = await apiClient.post('/api/delivery/security/scan-qr', {
        qrPayload: payload,
        signature: sig,
      });
      setDelivery((res.data.delivery as Record<string, unknown>) ?? null);
      toast.success('QR valid');
      void loadQueue();
    } catch (e: unknown) {
      setDelivery(null);
      const detail =
        typeof e === 'object' && e && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? '')
          : '';
      setError(detail || 'Scan failed');
    }
  };

  const allowEntry = async () => {
    if (!delivery?.id) return;
    try {
      const res = await apiClient.post(
        `/api/delivery/security/allow-entry/${String(delivery.id)}`,
      );
      setPassNumber(String(res.data.passNumber));
      setDelivery((prev) =>
        prev ? { ...prev, status: 'ARRIVED_AT_GATE' } : prev,
      );
      toast.success('Entry allowed');
      void loadQueue();
    } catch (e: unknown) {
      const detail =
        typeof e === 'object' && e && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? '')
          : '';
      toast.error(detail || 'Allow entry failed');
    }
  };

  const markExit = async () => {
    if (!delivery?.id) return;
    try {
      await apiClient.post(`/api/delivery/security/mark-exit/${String(delivery.id)}`);
      toast.success('Exit marked');
      setDelivery(null);
      setPassNumber(null);
      void loadQueue();
    } catch (e: unknown) {
      const detail =
        typeof e === 'object' && e && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? '')
          : '';
      toast.error(detail || 'Mark exit failed');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-amber-100 bg-white/90">
        <CardHeader>
          <CardTitle>Scan delivery QR</CardTitle>
          <p className="text-sm text-muted-foreground">
            Paste the driver&apos;s emailed QR JSON, validate, then allow entry or mark exit.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>QR JSON or payload</Label>
            <Input
              placeholder='{"qrPayload":"...","signature":"..."}'
              value={qrText}
              onChange={(e) => setQrText(e.target.value)}
            />
          </div>
          <div>
            <Label>Signature (if not in JSON)</Label>
            <Input value={signature} onChange={(e) => setSignature(e.target.value)} />
          </div>
          <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => void handleScan()}>
            Validate QR
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {delivery && (
        <Card className="border-teal-200 bg-teal-50/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{String(delivery.deliveryNumber ?? 'Delivery')}</CardTitle>
            <DeliveryStatusBadge status={String(delivery.status ?? '')} />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              {String(delivery.goodsType ?? 'Goods')} · {String(delivery.totalBoxes ?? 0)} boxes
            </p>
            <p>
              Driver / vehicle: {String(delivery.agentName ?? '—')} /{' '}
              {String(delivery.vehicleNumber ?? '—')}
            </p>
            {delivery.expectedArrivalTime ? (
              <p>ETA: {formatIstDateTime(String(delivery.expectedArrivalTime))}</p>
            ) : null}
            {passNumber && (
              <p className="rounded-md bg-white px-3 py-2 font-semibold text-teal-900">
                Gate pass: {passNumber}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(delivery.status === 'SCHEDULED' || delivery.status === 'APPROVED') && (
                <Button onClick={() => void allowEntry()}>Allow entry</Button>
              )}
              {delivery.status === 'RECEIVED' && (
                <Button variant="outline" onClick={() => void markExit()}>
                  Mark exit
                </Button>
              )}
            </div>
            {delivery.status === 'ARRIVED_AT_GATE' ||
            delivery.status === 'GATE_VERIFIED' ||
            delivery.status === 'IN_PROGRESS' ? (
              <p className="text-muted-foreground">
                Vehicle is inside — receiving must complete GRN before exit.
              </p>
            ) : null}
            {delivery.status === 'EXITED' || delivery.status === 'CLOSED' ? (
              <p className="text-muted-foreground">Delivery already exited.</p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 bg-white/90">
        <CardHeader>
          <CardTitle>Unified queue</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-2 font-medium">
              Walk-in visits ({queue?.walkInVisits?.length ?? 0})
            </p>
            <ul className="space-y-1">
              {(queue?.walkInVisits ?? []).slice(0, 6).map((v) => (
                <li key={String(v.id)} className="rounded border px-2 py-1">
                  {String(v.visitCategory)} — {String(v.platform ?? v.status)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 font-medium">
              Vendor deliveries ({queue?.vendorDeliveries?.length ?? 0})
            </p>
            <ul className="space-y-1">
              {(queue?.vendorDeliveries ?? []).slice(0, 6).map((d) => (
                <li
                  key={String(d.id)}
                  className="flex items-center justify-between rounded border px-2 py-1"
                >
                  <span>{String(d.deliveryNumber)}</span>
                  <DeliveryStatusBadge status={String(d.status)} />
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
