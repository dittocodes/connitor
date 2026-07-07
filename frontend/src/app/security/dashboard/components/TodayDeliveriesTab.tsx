'use client';

import * as React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Package, RefreshCw, ScanLine, Truck } from 'lucide-react';
import apiClient from '@/lib/api';
import { formatIstDateTime } from '@/lib/datetime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface ScheduledDelivery {
  id: string;
  deliveryNumber: string;
  status: string;
  goodsType?: string;
  totalBoxes?: number;
  expectedArrivalTime?: string | null;
  vendorName?: string | null;
  agentName?: string | null;
  agentPhone?: string | null;
  vehicleNumber?: string | null;
  branchName?: string | null;
}

type Props = {
  branchId: string;
  className?: string;
};

export function TodayDeliveriesTab({ branchId, className }: Props): React.ReactElement {
  const { data, isLoading, mutate } = useSWR(
    ['/api/security/deliveries/today', branchId],
    async () => {
      const res = await apiClient.get<{ deliveries: ScheduledDelivery[]; total: number }>(
        '/api/security/deliveries/today',
        { params: { branchId } },
      );
      return res.data;
    },
    { refreshInterval: 15_000 },
  );

  const deliveries = data?.deliveries ?? [];

  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5" /> Scheduled deliveries
          </h2>
          <p className="text-sm text-muted-foreground">
            Distributor bookings appear here immediately after scheduling.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading deliveries…</p>}

      {!isLoading && deliveries.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No scheduled deliveries for today.
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {deliveries.map((d) => (
          <li key={d.id}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{d.deliveryNumber}</CardTitle>
                    <p className="text-sm text-muted-foreground">{d.vendorName ?? 'Vendor'}</p>
                  </div>
                  <Badge variant="outline">{d.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {d.goodsType ?? 'Goods'} · {d.totalBoxes ?? 0} boxes
                </p>
                {d.expectedArrivalTime && (
                  <p>Arrival: {formatIstDateTime(d.expectedArrivalTime)}</p>
                )}
                <p>
                  Driver: {d.agentName ?? '—'}
                  {d.agentPhone ? ` · ${d.agentPhone}` : ''}
                </p>
                <p>Vehicle: {d.vehicleNumber ?? '—'}</p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/security/dashboard?tab=delivery-scan">
                    <ScanLine className="h-4 w-4 mr-1" /> Scan QR at gate
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
