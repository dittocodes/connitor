'use client';

import * as React from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { NavUser } from './nav-user';

export function MobileBottomNav({
  items,
  iconMap,
  pathname,
  user,
}: {
  items: { label: string; href: string; icon: string }[];
  iconMap: Record<string, React.ElementType>;
  pathname: string;
  user: {
    name: string;
    email: string;
    avatar: string;
    role: string;
    branchName: string;
    hospitalChainName: string;
  };
}) {
  // Always show up to 2 main items, then 3rd is always 3-dots (if more than 2 items)
  const mainItems = items.slice(0, 3);
  const moreItems = items.slice(3);
  const showMore = items.length > 2;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 bg-sidebar border-t border-sidebar-border lg:hidden pb-[env(safe-area-inset-bottom)]">
      {mainItems.map((item) => {
        const Icon = iconMap[item.icon];
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs ${
              isActive
                ? 'text-primary'
                : 'text-sidebar-foreground/70 hover:text-primary'
            }`}
          >
            {Icon && <Icon className="size-6" />}
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
      {showMore && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex-1 flex flex-col items-center justify-center gap-1 text-xs text-sidebar-foreground/70 hover:text-primary">
              <MoreHorizontal className="size-6" />
              <span>More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-56 p-0">
            {/* More menu items */}
            <div className="py-1">
              {moreItems.map((item) => {
                const Icon = iconMap[item.icon];
                return (
                  <DropdownMenuItem asChild key={item.href}>
                    <Link href={item.href} className="flex items-center gap-2">
                      {Icon && <Icon className="size-4" />}
                      <span>{item.label}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </div>
            <DropdownMenuSeparator />
            {/* NavUser at the bottom */}
            <div className="px-2 pb-2">
              <NavUser user={user} />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );
}
