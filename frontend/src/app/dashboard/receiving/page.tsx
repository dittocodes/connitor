'use client';

import * as React from 'react';
import apiClient from '@/lib/api';
import { useAuthSession } from '@/hooks/useAuthSession';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReceivingDashboardPage(): React.ReactElement {
  const user = useAuthSession<{ branchId?: string }>();
  const [docks, setDocks] = React.useState<Array<Record<string, string>>>([]);

  React.useEffect(() => {
    if (!user?.branchId) return;
    apiClient
      .get('/api/delivery/docks', { params: { branchId: user.branchId } })
      .then((res) => setDocks(res.data))
      .catch(() => setDocks([]));
  }, [user?.branchId]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Receiving</h1>
      <Card>
        <CardHeader>
          <CardTitle>Receiving docks</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 text-sm">
            {docks.map((d) => (
              <li key={d.id}>{d.dockName} ({d.dockCode})</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
