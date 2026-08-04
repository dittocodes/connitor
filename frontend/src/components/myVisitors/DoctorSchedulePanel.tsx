'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CalendarClock, Loader2, Trash2 } from 'lucide-react';
import {
  DoctorScheduleService,
  type DoctorScheduleSlot,
} from '@/lib/services/doctorScheduleService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return format(d, 'yyyy-MM-dd');
}

export function DoctorSchedulePanel(): React.ReactElement {
  const [fromDate, setFromDate] = React.useState(todayIso);
  const [toDate, setToDate] = React.useState(addDaysIso(6));
  const [startTime, setStartTime] = React.useState('09:00');
  const [endTime, setEndTime] = React.useState('12:00');
  const [slotMinutes, setSlotMinutes] = React.useState(30);
  const [slots, setSlots] = React.useState<DoctorScheduleSlot[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const items = await DoctorScheduleService.listSlots(fromDate, toDate);
      setSlots(items);
    } catch {
      toast.error('Could not load schedule');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const result = await DoctorScheduleService.createSlots({
        fromDate,
        toDate,
        startTime,
        endTime,
        slotMinutes,
      });
      toast.success(`Created ${result.created} slot(s)`, {
        description: result.skipped ? `${result.skipped} skipped (past or already exist)` : undefined,
      });
      await load();
    } catch (e: unknown) {
      const detail =
        typeof e === 'object' && e && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? '')
          : '';
      toast.error(detail || 'Could not create slots');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await DoctorScheduleService.deleteSlot(id);
      toast.success('Slot removed');
      await load();
    } catch (e: unknown) {
      const detail =
        typeof e === 'object' && e && 'response' in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? '')
          : '';
      toast.error(detail || 'Could not delete slot');
    }
  };

  const grouped = React.useMemo(() => {
    const map = new Map<string, DoctorScheduleSlot[]>();
    for (const s of slots) {
      const key = s.slotStart.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [slots]);

  return (
    <div className="space-y-6">
      <Card className="border-indigo-100 bg-white/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-indigo-600" />
            Publish availability
          </CardTitle>
          <CardDescription>
            Booked slots cannot be taken by another visitor. For walk-ins after a phone call, use{' '}
            <span className="font-medium text-indigo-800">Urgent passcode</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="sched-from">From date</Label>
              <Input
                id="sched-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-to">To date</Label>
              <Input
                id="sched-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-start">Start</Label>
              <Input
                id="sched-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-end">End</Label>
              <Input
                id="sched-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-mins">Minutes</Label>
              <Input
                id="sched-mins"
                type="number"
                min={5}
                max={240}
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(Number(e.target.value) || 30)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Creates slots Mon–Sat by default (Sundays skipped). Existing or past starts are skipped.
          </p>
          <Button
            type="button"
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={saving}
            onClick={() => void handleCreate()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Add slots'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Your slots</CardTitle>
            <CardDescription>
              {fromDate} → {toDate}
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">No slots in this range yet.</p>
          ) : (
            <ul className="space-y-4">
              {grouped.map(([day, daySlots]) => (
                <li key={day}>
                  <p className="mb-2 text-sm font-semibold text-slate-800">
                    {format(new Date(day + 'T12:00:00'), 'EEE, d MMM yyyy')}
                  </p>
                  <ul className="space-y-1.5">
                    {daySlots.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{s.label}</span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              s.isBooked
                                ? 'border-amber-200 bg-amber-50 text-amber-900'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            }
                          >
                            {s.isBooked ? 'Booked' : 'Open'}
                          </Badge>
                          {!s.isBooked && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => void handleDelete(s.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
