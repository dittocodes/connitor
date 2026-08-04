'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Copy, KeyRound, Loader2, Plus } from 'lucide-react';
import {
  UrgentPasscodeService,
  type UrgentPasscodeItem,
} from '@/lib/services/urgentPasscodeService';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const VISIT_THEMES = [
  'Consultation',
  'Follow-up',
  'Emergency',
  'Family visit',
  'Second opinion',
  'Procedure',
  'Other',
] as const;

type Mode = 'generate' | 'reuse';

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(local: string): string | undefined {
  if (!local.trim()) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function UrgentPasscodeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const [mode, setMode] = React.useState<Mode>('generate');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState('');
  const [purpose, setPurpose] = React.useState('');
  const [theme, setTheme] = React.useState<string>('');
  const [visitTime, setVisitTime] = React.useState('');
  const [issued, setIssued] = React.useState<UrgentPasscodeItem | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [list, setList] = React.useState<UrgentPasscodeItem[]>([]);
  const [listLoading, setListLoading] = React.useState(false);

  const activeCodes = React.useMemo(
    () => list.filter((row) => row.status === 'ACTIVE'),
    [list],
  );

  const loadList = React.useCallback(async () => {
    setListLoading(true);
    try {
      const items = await UrgentPasscodeService.list();
      setList(items);
    } catch {
      setList([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const resetForm = React.useCallback(() => {
    setMode('generate');
    setSelectedId(null);
    setIssued(null);
    setNote('');
    setPurpose('');
    setTheme('');
    setVisitTime('');
  }, []);

  React.useEffect(() => {
    if (open) {
      void loadList();
      resetForm();
    }
  }, [open, loadList, resetForm]);

  const applyPasscodeToForm = (row: UrgentPasscodeItem) => {
    setSelectedId(row.id);
    setIssued(row);
    setNote(row.note ?? '');
    setPurpose(row.purpose ?? '');
    setTheme(row.theme ?? '');
    setVisitTime(toDatetimeLocalValue(row.visitTime));
  };

  const buildPayload = () => ({
    note: note.trim() || undefined,
    purpose: purpose.trim() || undefined,
    theme: theme.trim() || undefined,
    visitTime: fromDatetimeLocalValue(visitTime),
  });

  const ensurePasscode = async (): Promise<UrgentPasscodeItem> => {
    const payload = buildPayload();
    if (mode === 'reuse') {
      if (!selectedId) {
        throw new Error('Select an existing passcode first');
      }
      return UrgentPasscodeService.update(selectedId, payload);
    }
    return UrgentPasscodeService.issue(payload);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const row = await ensurePasscode();
      setIssued(row);
      setSelectedId(row.id);
      if (mode === 'generate') {
        setMode('reuse');
      }
      toast.success(
        mode === 'generate'
          ? 'Urgent passcode created — copy and share it with your visitor'
          : 'Passcode details updated',
      );
      await loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create passcode');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Passcode copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const revoke = async (id: string) => {
    try {
      await UrgentPasscodeService.revoke(id);
      toast.success('Passcode revoked');
      await loadList();
      if (issued?.id === id || selectedId === id) {
        setIssued(null);
        setSelectedId(null);
        setMode('generate');
      }
    } catch {
      toast.error('Could not revoke');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-600" />
            Urgent entry passcode
          </DialogTitle>
          <DialogDescription>
            Share a 6-digit code for the gate. Security verifies it, then the visitor registers and
            books with you on the spot (auto-approved — no further approval). They receive Entry and
            Exit QR codes. Codes last 24 hours and do not use calendar slots.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg border p-1">
            <button
              type="button"
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                mode === 'generate'
                  ? 'bg-indigo-600 text-white'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => {
                setMode('generate');
                setSelectedId(null);
                setIssued(null);
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Generate new
              </span>
            </button>
            <button
              type="button"
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                mode === 'reuse'
                  ? 'bg-indigo-600 text-white'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => setMode('reuse')}
            >
              Use existing
            </button>
          </div>

          {mode === 'reuse' && (
            <div className="space-y-2">
              <Label>Active passcode</Label>
              {listLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : activeCodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active passcodes. Switch to Generate new.
                </p>
              ) : (
                <Select
                  value={selectedId ?? undefined}
                  onValueChange={(id) => {
                    const row = activeCodes.find((item) => item.id === id);
                    if (row) applyPasscodeToForm(row);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a passcode" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCodes.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.code}
                        {row.theme ? ` · ${row.theme}` : ''}
                        {' · '}
                        expires {new Date(row.expiresAt).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="urgent-visit-time">Visit time</Label>
              <Input
                id="urgent-visit-time"
                type="datetime-local"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Theme of visit</Label>
              <Select value={theme || undefined} onValueChange={setTheme}>
                <SelectTrigger>
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_THEMES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="urgent-purpose">Purpose of visit</Label>
            <Textarea
              id="urgent-purpose"
              placeholder="e.g. Discuss lab results / urgent consultation"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="urgent-note">Note for security (optional)</Label>
            <Textarea
              id="urgent-note"
              placeholder="e.g. Called me — urgent follow-up"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>

          {issued && issued.status === 'ACTIVE' && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Share this code with the visitor</p>
              <p className="text-4xl font-mono font-bold tracking-[0.3em] text-indigo-900">
                {issued.code}
              </p>
              <p className="text-xs text-muted-foreground">
                Valid until {new Date(issued.expiresAt).toLocaleString()}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyCode(issued.code)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy code
              </Button>
            </div>
          )}

          <div className="space-y-2 max-h-40 overflow-y-auto">
            <p className="text-sm font-medium">Recent passcodes</p>
            {listLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : list.length === 0 ? (
              <p className="text-sm text-muted-foreground">No passcodes yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {list.map((row) => (
                  <li
                    key={row.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1.5',
                      selectedId === row.id && 'border-indigo-400 bg-indigo-50/60',
                    )}
                  >
                    <button
                      type="button"
                      className="text-left font-mono disabled:opacity-50"
                      disabled={row.status !== 'ACTIVE'}
                      onClick={() => {
                        if (row.status !== 'ACTIVE') return;
                        setMode('reuse');
                        applyPasscodeToForm(row);
                      }}
                    >
                      {row.status === 'ACTIVE' ? row.code : `••••${row.code.slice(-2)}`}
                      {row.theme ? (
                        <span className="ml-2 font-sans text-muted-foreground">{row.theme}</span>
                      ) : null}
                    </button>
                    <Badge variant="outline">{row.status}</Badge>
                    {row.status === 'ACTIVE' && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => void revoke(row.id)}>
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={loading || (mode === 'reuse' && !selectedId)}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : mode === 'reuse' ? (
              'Update passcode'
            ) : (
              'Generate passcode'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
