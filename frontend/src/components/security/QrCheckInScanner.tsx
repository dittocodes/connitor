'use client';

import * as React from 'react';
import { AlertCircle, Camera, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  onScan: (payload: string) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
};

export function QrCheckInScanner({ onScan, disabled = false, className }: Props) {
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const scannerRef = React.useRef<{ stop: () => Promise<void> } | null>(null);
  const handledRef = React.useRef(false);

  const stopScanner = React.useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore stop errors when camera already closed
      }
      scannerRef.current = null;
    }
    setActive(false);
  }, []);

  React.useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  const startScanner = async () => {
    if (disabled || active) return;
    setError(null);
    setStarting(true);
    handledRef.current = false;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('security-qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (handledRef.current) return;
          handledRef.current = true;
          await stopScanner();
          await onScan(decodedText);
        },
        () => {
          // ignore per-frame scan misses
        },
      );
      setActive(true);
    } catch {
      setError('Could not access camera. Allow camera permission or use OTP entry instead.');
      await stopScanner();
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div
        id="security-qr-reader"
        className={cn(
          'mx-auto overflow-hidden rounded-lg border border-gray-200 bg-black/5',
          !active && 'hidden',
        )}
      />

      {!active && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <Camera className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 text-sm text-gray-600">
            Ask the visitor to show the QR code from their approval email or visitor portal.
          </p>
          <Button
            type="button"
            className="mt-4 bg-emerald-600 hover:bg-emerald-700"
            onClick={startScanner}
            disabled={disabled || starting}
          >
            {starting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting camera...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Scan QR Code
              </>
            )}
          </Button>
        </div>
      )}

      {active && (
        <Button type="button" variant="outline" className="w-full" onClick={stopScanner}>
          Stop scanner
        </Button>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
