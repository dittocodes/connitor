'use client';

import * as React from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api';
import { useAuthSession } from '@/hooks/useAuthSession';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DeliveryEmptyState, DeliveryPageShell } from '@/features/delivery-management/ui';

interface MappingRow {
  mappingId: string;
  approvalStatus: string;
  vendor: {
    id: string;
    vendorCode: string;
    vendorName: string;
    email?: string | null;
    phone?: string | null;
  };
}

export default function DeliveryVendorsPage(): React.ReactElement {
  const user = useAuthSession<{ branchId?: string }>();
  const branchId = user?.branchId;
  const [items, setItems] = React.useState<MappingRow[]>([]);

  const load = React.useCallback(async () => {
    if (!branchId) return;
    try {
      const res = await apiClient.get('/api/delivery/vendor-mappings', {
        params: { branchId },
      });
      setItems(res.data.items ?? []);
    } catch {
      toast.error('Could not load vendors');
      setItems([]);
    }
  }, [branchId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const approve = async (mappingId: string) => {
    try {
      await apiClient.post(`/api/delivery/vendor-mappings/${mappingId}/approve`);
      toast.success('Vendor approved for this branch');
      await load();
    } catch {
      toast.error('Approve failed');
    }
  };

  return (
    <DeliveryPageShell
      title="Delivery vendors"
      subtitle="Approve distributor mappings so they can book deliveries to this hospital."
    >
      <Card className="border-amber-100 bg-white/90">
        <CardHeader>
          <CardTitle>Branch mappings</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <DeliveryEmptyState
              title="No vendor mappings"
              description="Distributors appear here when linked to your branch."
            />
          ) : (
            <ul className="space-y-2">
              {items.map((m) => (
                <li
                  key={m.mappingId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {m.vendor.vendorName}{' '}
                      <span className="text-muted-foreground">({m.vendor.vendorCode})</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {m.vendor.email ?? '—'} · {m.vendor.phone ?? '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        m.approvalStatus === 'APPROVED'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-amber-200 bg-amber-50 text-amber-900'
                      }
                    >
                      {m.approvalStatus}
                    </Badge>
                    {m.approvalStatus !== 'APPROVED' && (
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => void approve(m.mappingId)}>
                        Approve
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </DeliveryPageShell>
  );
}
