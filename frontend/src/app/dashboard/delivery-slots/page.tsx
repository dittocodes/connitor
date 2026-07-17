'use client';

import * as React from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api';
import { useAuthSession } from '@/hooks/useAuthSession';
import { formatIstDateTime, todayIstDateIso } from '@/lib/datetime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeliveryEmptyState, DeliveryPageShell } from '@/features/delivery-management/ui';

interface SlotRow {
  id: string;
  slotStart: string;
  slotEnd: string;
  maxDeliveries: number;
  bookedCount: number;
  remaining: number;
  isActive: boolean;
}

export default function DeliverySlotsPage(): React.ReactElement {
  const user = useAuthSession<{ branchId?: string }>();
  const branchId = user?.branchId ?? '';
  const [viewDate, setViewDate] = React.useState(todayIstDateIso());
  const [startDate, setStartDate] = React.useState(todayIstDateIso());
  const [endDate, setEndDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [allowUnscheduled, setAllowUnscheduled] = React.useState(true);
  const [slots, setSlots] = React.useState<SlotRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadSlots = React.useCallback(async () => {
    if (!branchId || !viewDate) return;
    try {
      const res = await apiClient.get(`/api/delivery/branches/${branchId}/slots`, {
        params: { date: viewDate },
      });
      setSlots(res.data.slots ?? []);
    } catch {
      setSlots([]);
    }
  }, [branchId, viewDate]);

  React.useEffect(() => {
    if (!branchId) return;
    apiClient
      .get(`/api/delivery/branch-settings/${branchId}`)
      .then((res) => setAllowUnscheduled(res.data.allowUnscheduledDeliveries ?? true))
      .catch(() => undefined);
  }, [branchId]);

  React.useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const generateSlots = async () => {
    if (!branchId) {
      toast.error('No branch assigned');
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
      await loadSlots();
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
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  return (
    <DeliveryPageShell
      title="Delivery time slots"
      subtitle="Generate receiving windows and review capacity for each day."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-amber-100 bg-white/90">
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
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              disabled={loading}
              onClick={() => void generateSlots()}
            >
              {loading ? 'Generating…' : 'Generate hourly slots'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-teal-100 bg-white/90">
          <CardHeader>
            <CardTitle>Branch policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowUnscheduled}
                onChange={(e) => setAllowUnscheduled(e.target.checked)}
              />
              Allow unscheduled deliveries
            </label>
            <Button variant="outline" onClick={() => void saveSettings()}>
              Save settings
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-100 bg-white/90">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Day schedule</CardTitle>
          <Input
            type="date"
            className="w-44"
            value={viewDate}
            onChange={(e) => setViewDate(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          {slots.length === 0 ? (
            <DeliveryEmptyState
              title="No slots for this day"
              description="Generate a date range above to create receiving windows."
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {slots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm"
                >
                  <span>
                    {formatIstDateTime(s.slotStart)} – {formatIstDateTime(s.slotEnd)}
                  </span>
                  <span className="font-medium text-teal-800">
                    {s.remaining}/{s.maxDeliveries} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </DeliveryPageShell>
  );
}
