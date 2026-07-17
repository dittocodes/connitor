'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Building2, Calendar, CheckCircle2, Package, Truck, User } from 'lucide-react';
import {
  DistributorDeliveryService,
  type ApprovedBranch,
  type DeliveryAgent,
  type DeliverySlot,
  type DeliveryVehicle,
} from '@/lib/services/distributorDeliveryService';
import { todayIstDateIso, formatIstDateTime } from '@/lib/datetime';
import { DeliveryStepper } from '@/features/delivery-management/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const WIZARD_STEPS = ['Hospital', 'Slot', 'Goods', 'Vehicle', 'Driver', 'Review'];

const GOODS_TYPES = [
  'Medical supplies',
  'Pharmaceuticals',
  'Surgical equipment',
  'Lab consumables',
  'General goods',
];

export function DeliveryBookingWizard(): React.ReactElement {
  const [step, setStep] = React.useState<Step>(1);
  const [branches, setBranches] = React.useState<ApprovedBranch[]>([]);
  const [branchId, setBranchId] = React.useState('');
  const [slotDate, setSlotDate] = React.useState(todayIstDateIso());
  const [slots, setSlots] = React.useState<DeliverySlot[]>([]);
  const [slotId, setSlotId] = React.useState('');
  const [allowUnscheduled, setAllowUnscheduled] = React.useState(false);
  const [useUnscheduled, setUseUnscheduled] = React.useState(false);
  const [expectedArrivalTime, setExpectedArrivalTime] = React.useState('');
  const [goodsType, setGoodsType] = React.useState('');
  const [customGoods, setCustomGoods] = React.useState('');
  const [totalBoxes, setTotalBoxes] = React.useState('1');
  const [vehicles, setVehicles] = React.useState<DeliveryVehicle[]>([]);
  const [agents, setAgents] = React.useState<DeliveryAgent[]>([]);
  const [vehicleMode, setVehicleMode] = React.useState<'existing' | 'new'>('existing');
  const [vehicleId, setVehicleId] = React.useState('');
  const [vehicleReg, setVehicleReg] = React.useState('');
  const [vehicleType, setVehicleType] = React.useState('');
  const [agentMode, setAgentMode] = React.useState<'existing' | 'new'>('existing');
  const [agentId, setAgentId] = React.useState('');
  const [agentName, setAgentName] = React.useState('');
  const [agentEmail, setAgentEmail] = React.useState('');
  const [agentPhone, setAgentPhone] = React.useState('');
  const [remarks, setRemarks] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState<{ deliveryNumber: string } | null>(null);

  React.useEffect(() => {
    DistributorDeliveryService.listBranches()
      .then(setBranches)
      .catch(() => toast.error('Could not load hospitals'));
    DistributorDeliveryService.listVehicles().then(setVehicles).catch(() => undefined);
    DistributorDeliveryService.listAgents().then(setAgents).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (!branchId || !slotDate) return;
    DistributorDeliveryService.listSlots(branchId, slotDate)
      .then(setSlots)
      .catch(() => setSlots([]));
    DistributorDeliveryService.getBranchSettings(branchId)
      .then((s) => setAllowUnscheduled(s.allowUnscheduledDeliveries))
      .catch(() => setAllowUnscheduled(false));
  }, [branchId, slotDate]);

  const selectedBranch = branches.find((b) => b.id === branchId);
  const resolvedGoods = goodsType === 'Other' ? customGoods.trim() : goodsType;

  const submit = async () => {
    setLoading(true);
    try {
      const payload = {
        branchId,
        goodsType: resolvedGoods,
        totalBoxes: parseInt(totalBoxes, 10),
        remarks: remarks.trim() || undefined,
        slotId: useUnscheduled ? undefined : slotId || undefined,
        expectedArrivalTime: useUnscheduled ? expectedArrivalTime : undefined,
        vehicleId: vehicleMode === 'existing' ? vehicleId : undefined,
        vehicle:
          vehicleMode === 'new'
            ? { registrationNumber: vehicleReg.trim(), vehicleType: vehicleType || undefined }
            : undefined,
        agentId: agentMode === 'existing' ? agentId : undefined,
        agent:
          agentMode === 'new'
            ? {
                name: agentName.trim(),
                email: agentEmail.trim(),
                phone: agentPhone.trim() || undefined,
              }
            : undefined,
      };
      const result = await DistributorDeliveryService.bookDelivery(payload);
      setSuccess({ deliveryNumber: result.deliveryNumber });
      toast.success('Delivery booked');
    } catch {
      toast.error('Booking failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
        <CardContent className="space-y-4 pt-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="text-xl font-semibold text-slate-900">Delivery booked</h2>
          <p className="text-muted-foreground">
            Reference: <strong>{success.deliveryNumber}</strong>
          </p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Security and hospital admins have been notified. The driver will receive full delivery
            instructions and the gate check-in QR by email — no app login needed.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = '/vendor/deliveries';
              }}
            >
              View deliveries
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => window.location.reload()}
            >
              Book another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <DeliveryStepper steps={WIZARD_STEPS} current={step} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Select hospital
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose approved hospital" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} — {b.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBranch && (
              <p className="text-sm text-muted-foreground">
                {selectedBranch.street}, {selectedBranch.city} · {selectedBranch.phone}
              </p>
            )}
            <Button disabled={!branchId} onClick={() => setStep(2)}>
              Next
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Delivery time slot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
            </div>
            {allowUnscheduled && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useUnscheduled}
                  onChange={(e) => setUseUnscheduled(e.target.checked)}
                />
                Book without a fixed slot (unscheduled)
              </label>
            )}
            {useUnscheduled ? (
              <div>
                <Label>Expected arrival</Label>
                <Input
                  type="datetime-local"
                  value={expectedArrivalTime}
                  onChange={(e) => setExpectedArrivalTime(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Available slots</Label>
                {slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No slots for this date.</p>
                ) : (
                  slots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      className={`w-full text-left rounded-lg border p-3 text-sm ${
                        slotId === slot.id ? 'border-teal-600 bg-teal-50' : ''
                      }`}
                      onClick={() => setSlotId(slot.id)}
                    >
                      {formatIstDateTime(slot.slotStart)} – {formatIstDateTime(slot.slotEnd)}
                      <span className="text-muted-foreground ml-2">({slot.remaining} left)</span>
                    </button>
                  ))
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                disabled={useUnscheduled ? !expectedArrivalTime : !slotId}
                onClick={() => setStep(3)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Goods details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Type of goods</Label>
              <Select value={goodsType} onValueChange={setGoodsType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {GOODS_TYPES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {goodsType === 'Other' && (
              <Input
                placeholder="Describe goods"
                value={customGoods}
                onChange={(e) => setCustomGoods(e.target.value)}
              />
            )}
            <div>
              <Label>Number of boxes</Label>
              <Input
                type="number"
                min={1}
                value={totalBoxes}
                onChange={(e) => setTotalBoxes(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                disabled={!resolvedGoods || parseInt(totalBoxes, 10) < 1}
                onClick={() => setStep(4)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" /> Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={vehicleMode}
              onValueChange={(v) => setVehicleMode(v as 'existing' | 'new')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="existing">Select existing vehicle</SelectItem>
                <SelectItem value="new">Add new vehicle</SelectItem>
              </SelectContent>
            </Select>
            {vehicleMode === 'existing' ? (
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.registrationNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input
                  placeholder="Registration number"
                  value={vehicleReg}
                  onChange={(e) => setVehicleReg(e.target.value)}
                />
                <Input
                  placeholder="Vehicle type (optional)"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                />
              </>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button
                disabled={vehicleMode === 'existing' ? !vehicleId : !vehicleReg.trim()}
                onClick={() => setStep(5)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Driver
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={agentMode} onValueChange={(v) => setAgentMode(v as 'existing' | 'new')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="existing">Select existing driver</SelectItem>
                <SelectItem value="new">Add new driver</SelectItem>
              </SelectContent>
            </Select>
            {agentMode === 'existing' ? (
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Driver" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} {a.email ? `(${a.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input
                  placeholder="Driver name"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                />
                <Input
                  type="email"
                  placeholder="Driver email"
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                />
                <Input
                  placeholder="Driver phone (optional)"
                  value={agentPhone}
                  onChange={(e) => setAgentPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The driver will receive full delivery instructions and the gate check-in QR by
                  email when you book.
                </p>
              </>
            )}
            <div>
              <Label>Delivery instructions (optional)</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(4)}>
                Back
              </Button>
              <Button
                disabled={
                  agentMode === 'existing'
                    ? !agentId
                    : !agentName.trim() || !agentEmail.trim()
                }
                onClick={() => setStep(6)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & submit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>Hospital:</strong> {selectedBranch?.name}
            </p>
            <p>
              <strong>Goods:</strong> {resolvedGoods} · {totalBoxes} boxes
            </p>
            <p>
              <strong>Vehicle:</strong>{' '}
              {vehicleMode === 'existing'
                ? vehicles.find((v) => v.id === vehicleId)?.registrationNumber
                : vehicleReg}
            </p>
            <p>
              <strong>Driver:</strong>{' '}
              {agentMode === 'existing'
                ? agents.find((a) => a.id === agentId)?.name
                : agentName}
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(5)}>
                Back
              </Button>
              <Button disabled={loading} onClick={() => void submit()}>
                {loading ? 'Booking…' : 'Book delivery'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
