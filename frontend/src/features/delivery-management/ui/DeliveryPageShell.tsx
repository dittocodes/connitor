import * as React from 'react';
import { cn } from '@/lib/utils';

export function DeliveryPageShell({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn('min-h-full bg-gradient-to-br from-amber-50/40 via-white to-teal-50/30', className)}>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-amber-100/80 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/80">
              Delivery
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
