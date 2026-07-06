'use client';

import * as React from 'react';
import apiClient from '@/lib/api';
import { useAuthSession } from '@/hooks/useAuthSession';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AttendantPassesPage(): React.ReactElement {
  const user = useAuthSession<{ branchId?: string }>();
  const [passes, setPasses] = React.useState<Array<Record<string, unknown>>>([]);

  React.useEffect(() => {
    if (!user?.branchId) return;
    apiClient
      .get('/api/attendant-passes/passes', { params: { branchId: user.branchId } })
      .then((res) => setPasses(res.data.items ?? []))
      .catch(() => setPasses([]));
  }, [user?.branchId]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Attendant Passes</h1>
      <Card>
        <CardHeader>
          <CardTitle>Active passes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2">
            {passes.map((p) => (
              <li key={String(p.id)}>
                {String(p.passNumber)} — {String(p.status)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
