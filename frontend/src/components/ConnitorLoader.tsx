'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

type ConnitorLoaderProps = {
  /** Short status line under the brand name */
  message?: string;
  /** inline = compact in-flow; section = centered block; overlay = covers parent */
  variant?: 'inline' | 'section' | 'overlay';
  className?: string;
};

/**
 * Branded loading indicator using the Connitor name + logo.
 */
export function ConnitorLoader({
  message = 'Loading…',
  variant = 'section',
  className,
}: ConnitorLoaderProps) {
  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        variant === 'inline' && 'flex-row gap-2.5 text-left',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={cn(
          'relative flex items-center justify-center',
          variant === 'inline' ? 'h-8 w-8' : 'h-14 w-14',
        )}
      >
        <span
          className={cn(
            'absolute inset-0 rounded-full bg-teal-200/50 animate-ping',
            variant === 'inline' && 'opacity-70',
          )}
          aria-hidden
        />
        <Image
          src="/ConnInter.png"
          alt=""
          width={variant === 'inline' ? 32 : 56}
          height={variant === 'inline' ? 32 : 56}
          className={cn(
            'relative z-10 object-contain drop-shadow-sm animate-pulse',
            variant === 'inline' ? 'h-8 w-8' : 'h-12 w-12',
          )}
          priority
        />
      </div>
      <div className={cn(variant === 'inline' && 'min-w-0')}>
        <p
          className={cn(
            'font-semibold tracking-tight text-teal-900',
            variant === 'inline' ? 'text-sm' : 'text-lg',
          )}
        >
          Connitor
        </p>
        {message ? (
          <p
            className={cn(
              'text-muted-foreground',
              variant === 'inline' ? 'text-xs' : 'text-sm mt-0.5',
            )}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (variant === 'overlay') {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-[2px]">
        {content}
      </div>
    );
  }

  return content;
}
