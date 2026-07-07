'use client';

import * as React from 'react';
import apiClient from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthSession } from '@/hooks/useAuthSession';
import { formatIstDateTime } from '@/lib/datetime';

interface DeliveryRow {
  id: string;
  deliveryNumber: string;
  status: string;
  goodsType?: string;
  totalBoxes?: number;
  expectedArrivalTime?: string | null;
  vendorName?: string | null;
  agentName?: string | null;
  vehicleNumber?: string | null;
  branchName?: string | null;
}

export default function DeliveryDashboardPage(): React.ReactElement {
  const user = useAuthSession<{ branchId?: string; role?: string }>();
  const branchId = user?.branchId;
  const [summary, setSummary] = React.useState<Record<string, unknown> | null>(null);
  const [deliveries, setDeliveries] = React.useState<DeliveryRow[]>([]);

  React.useEffect(() => {
    const params = user?.role === 'SUPER_ADMIN' ? {} : { branchId };
    apiClient
      .get('/api/delivery/deliveries', { params: { ...params, limit: 50 } })
      .then((res) => setDeliveries(res.data.items ?? []))
      .catch(() => setDeliveries([]));
    if (branchId) {
      apiClient
        .get('/api/delivery/deliveries/dashboard/summary', { params: { branchId } })
        .then((res) => setSummary(res.data))
        .catch(() => setSummary(null));
    }
  }, [branchId, user?.role]);

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <h1 className="text-2xl font-bold">Delivery Management</h1>
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Branch summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>Total: {String(summary.total ?? 0)}</p>
            {summary.byStatus && typeof summary.byStatus === 'object' ? (
              <ul className="mt-2 space-y-1">
                {Object.entries(summary.byStatus as Record<string, number>).map(([k, v]) => (
                  <li key={k}>
                    {k}: {v}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Number</th>
                  <th className="py-2 pr-4">Goods</th>
                  <th className="py-2 pr-4">Vendor</th>
                  <th className="py-2 pr-4">Driver</th>
                  <th className="py-2 pr-4">Vehicle</th>
                  <th className="py-2 pr-4">Arrival</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      No deliveries found.
                    </td>
                  </tr>
                )}
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-b">
                    <td className="py-2 pr-4 font-medium">{d.deliveryNumber}</td>
                    <td className="py-2 pr-4">
                      {d.goodsType ?? '—'} ({d.totalBoxes ?? 0})
                    </td>
                    <td className="py-2 pr-4">{d.vendorName ?? '—'}</td>
                    <td className="py-2 pr-4">{d.agentName ?? '—'}</td>
                    <td className="py-2 pr-4">{d.vehicleNumber ?? '—'}</td>
                    <td className="py-2 pr-4">
                      {d.expectedArrivalTime ? formatIstDateTime(d.expectedArrivalTime) : '—'}
                    </td>
                    <td className="py-2">{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
