'use client';

import * as React from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api';
import { useAuthSession } from '@/hooks/useAuthSession';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { todayIstDateIso } from '@/lib/datetime';

export default function DeliverySlotsPage(): React.ReactElement {
  const user = useAuthSession<{ branchId?: string }>();
  const branchId = user?.branchId ?? '';
  const [startDate, setStartDate] = React.useState(todayIstDateIso());
  const [endDate, setEndDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [allowUnscheduled, setAllowUnscheduled] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!branchId) return;
    apiClient
      .get(`/api/delivery/branch-settings/${branchId}`)
      .then((res) => setAllowUnscheduled(res.data.allowUnscheduledDeliveries ?? true))
      .catch(() => undefined);
  }, [branchId]);

  const generateSlots = async () => {
    if (!branchId) {
      toast.error('No branch assigned to your account');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post(`/api/delivery/branches/${branchId}/slots`, {
        startDate,
        endDate,
        slotMinutes: 60,
        maxDeliveries: 2,
      });
      toast.success(`Created ${res.data.created} delivery slots`);
    } catch {
      toast.error('Failed to generate slots');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!branchId) return;
    try {
      await apiClient.put(`/api/delivery/branch-settings/${branchId}`, {
        allowUnscheduledDeliveries: allowUnscheduled,
      });
      toast.success('Branch delivery settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Delivery time slots</h1>
      <p className="text-sm text-muted-foreground">
        Generate hourly receiving windows for distributors to book deliveries.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Generate slots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button disabled={loading || !branchId} onClick={() => void generateSlots()}>
            Generate slots (9–12 & 14–17, hourly)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branch settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowUnscheduled}
              onChange={(e) => setAllowUnscheduled(e.target.checked)}
            />
            Allow unscheduled deliveries (distributor picks custom arrival time)
          </label>
          <Button variant="outline" onClick={() => void saveSettings()}>
            Save settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
