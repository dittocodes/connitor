'use client';

import * as React from 'react';
import { DeliveryBookingWizard } from '@/features/distributor-delivery/DeliveryBookingWizard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import apiClient from '@/lib/api';

export default function VendorDeliveriesPage(): React.ReactElement {
  const [items, setItems] = React.useState<Array<Record<string, unknown>>>([]);
  const [showWizard, setShowWizard] = React.useState(false);

  const load = React.useCallback(() => {
    apiClient
      .get('/api/delivery/deliveries')
      .then((res) => setItems(res.data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (showWizard) {
    return (
      <div className="p-6 space-y-4">
        <button
          type="button"
          className="text-sm text-teal-700 underline"
          onClick={() => {
            setShowWizard(false);
            load();
          }}
        >
          ← Back to deliveries
        </button>
        <h1 className="text-2xl font-bold">Book delivery</h1>
        <DeliveryBookingWizard />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Deliveries</h1>
        <button
          type="button"
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white"
          onClick={() => setShowWizard(true)}
        >
          Book delivery
        </button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2">
            {items.length === 0 && (
              <li className="text-muted-foreground">No deliveries yet. Book your first delivery.</li>
            )}
            {items.map((d) => (
              <li key={String(d.id)} className="flex justify-between border-b pb-2">
                <span>
                  {String(d.deliveryNumber)} — {String(d.goodsType ?? 'Goods')}
                </span>
                <span className="text-muted-foreground">{String(d.status)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
