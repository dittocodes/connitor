'use client';

import * as React from 'react';
import apiClient from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function VendorDeliveriesPage(): React.ReactElement {
  const [items, setItems] = React.useState<Array<Record<string, unknown>>>([]);

  React.useEffect(() => {
    apiClient
      .get('/api/delivery/deliveries')
      .then((res) => setItems(res.data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Deliveries</h1>
      <Card>
        <CardContent className="pt-6">
          <ul className="text-sm space-y-2">
            {items.map((d) => (
              <li key={String(d.id)}>
                {String(d.deliveryNumber)} — {String(d.status)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
