'use client';

import * as React from 'react';
import apiClient from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthSession } from '@/hooks/useAuthSession';

export default function DeliveryDashboardPage(): React.ReactElement {
  const user = useAuthSession<{ branchId?: string }>();
  const branchId = user?.branchId;
  const [summary, setSummary] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    if (!branchId) return;
    apiClient
      .get('/api/delivery/deliveries/dashboard/summary', { params: { branchId } })
      .then((res) => setSummary(res.data))
      .catch(() => setSummary(null));
  }, [branchId]);

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Delivery Management</h1>
      <Card>
        <CardHeader>
          <CardTitle>Branch summary</CardTitle>
        </CardHeader>
        <CardContent>
          {summary ? (
            <pre className="text-sm">{JSON.stringify(summary, null, 2)}</pre>
          ) : (
            <p className="text-muted-foreground text-sm">Loading delivery stats…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
