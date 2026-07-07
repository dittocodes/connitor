'use client';

import * as React from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { MapPin, Phone, Package, LogOut } from 'lucide-react';
import { useDriverAuthSession } from '@/hooks/useDriverAuthSession';
import { DriverAuthService, type DriverAssignment } from '@/lib/services/driverAuthService';
import { formatIstDateTime } from '@/lib/datetime';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function DriverDashboardPage(): React.ReactElement {
  const { user, ready } = useDriverAuthSession();
  const [assignments, setAssignments] = React.useState<DriverAssignment[]>([]);

  React.useEffect(() => {
    if (!ready || !user) return;
    DriverAuthService.getAssignments()
      .then(setAssignments)
      .catch(() => setAssignments([]));
  }, [ready, user]);

  if (!ready) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  const active = assignments[0];

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Driver dashboard</h1>
            <p className="text-sm text-muted-foreground">{user?.name ?? user?.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              DriverAuthService.logout();
              window.location.href = '/driver/login';
            }}
          >
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>

        {!active ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground text-sm">
              No active delivery assignments.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{active.deliveryNumber}</CardTitle>
                <p className="text-sm text-muted-foreground capitalize">{active.status.toLowerCase()}</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {active.goodsType} · {active.totalBoxes} boxes
                </p>
                {active.expectedArrivalTime && (
                  <p>Arrival: {formatIstDateTime(active.expectedArrivalTime)}</p>
                )}
                {active.vehicleNumber && <p>Vehicle: {active.vehicleNumber}</p>}
                {active.remarks && <p className="text-muted-foreground">{active.remarks}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hospital</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{active.hospital.name}</p>
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                  {active.hospital.address}
                </p>
                {active.hospital.phone && (
                  <a
                    href={`tel:${active.hospital.phone}`}
                    className="flex items-center gap-2 text-teal-700"
                  >
                    <Phone className="h-4 w-4" />
                    {active.hospital.phone}
                  </a>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={mapsUrl(active.hospital.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Maps
                  </a>
                </Button>
              </CardContent>
            </Card>

            {active.qr && (
              <Card>
                <CardHeader>
                  <CardTitle>Check-in QR</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Show this at the hospital security gate.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-3">
                  <QRCodeSVG
                    value={JSON.stringify({
                      qrPayload: active.qr.qrPayload,
                      signature: active.qr.signature,
                    })}
                    size={200}
                    level="M"
                    includeMargin
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Valid until {formatIstDateTime(active.qr.expiresAt)}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/driver/login" className="underline">
            Switch account
          </Link>
        </p>
      </div>
    </div>
  );
}
