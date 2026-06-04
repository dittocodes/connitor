'use client';

import { usePathname } from 'next/navigation';
import { sidebarConfig } from '@/lib/sidebar-config';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { TeamSwitcher } from './team-switcher';
import { NavUser } from './nav-user';
import Link from 'next/link';
import {
  LayoutDashboard,
  Hospital,
  Building,
  Users,
  Settings,
  UserPlus,
  Book,
} from 'lucide-react';
import { useResponsive } from '@/hooks/use-mobile';
import { MobileBottomNav } from './mobile-bottom-nav';

// Map icon string to Lucide icon component
const iconMap = {
  dashboard: LayoutDashboard,
  hospital: Hospital,
  building: Building,
  users: Users,
  settings: Settings,
  'user-plus': UserPlus,
  book: Book,
};

// Define User Profile structure from API
interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  hospitalChainName?: string; // <-- Add this
  branchName?: string; // <-- Add this
  hospitalChain?: {
    name: string;
  } | null;
  branch?: {
    name: string;
  } | null;
}

interface RoleSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: UserProfile;
}

export function RoleSidebar(props: RoleSidebarProps) {
  const { user } = props;
  const pathname = usePathname();
  const { isMobile, isTablet } = useResponsive();

  if (!user || !user.role) return null;

  const items = sidebarConfig[user.role as keyof typeof sidebarConfig] || [];

  // Dynamic teamsData based on user info
  const teamsData = [
    {
      name: user.name,
      logo: Hospital,
      role: user.role,
      hospitalChainName:
        user.hospitalChainName ?? user.hospitalChain?.name ?? '',
      branchName: user.branchName ?? user.branch?.name ?? '',
    },
  ];

  // Only show sidebar on desktop
  if (!(isMobile || isTablet)) {
    return (
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <TeamSwitcher teams={teamsData} />
        </SidebarHeader>
        <SidebarContent className="p-2 mt-4">
          <SidebarMenu>
            {items.map((item) => {
              const Icon = iconMap[item.icon as keyof typeof iconMap];
              const isActive = pathname === item.href;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:text-primary-foreground'
                        : ''
                    }`}
                  >
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 w-full"
                    >
                      <span className="flex items-center justify-center w-6 h-6">
                        {Icon && <Icon className="size-5" />}
                      </span>
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <NavUser
            user={{
              name: user.name,
              email: user.email,
              avatar: user.name
                ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.name,
                  )}`
                : '',
              role: user.role,
              branchName: user.branchName ?? user.branch?.name ?? '',
              hospitalChainName:
                user.hospitalChainName ?? user.hospitalChain?.name ?? '',
            }}
          />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    );
  }

  // On mobile/tablet, show only bottom nav
  return (
    <>
      <MobileBottomNav
        items={items}
        iconMap={iconMap}
        pathname={pathname}
        user={{
          name: user.name,
          email: user.email,
          avatar: user.name
            ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
                user.name,
              )}`
            : '',
          role: user.role,
          branchName: user.branchName ?? user.branch?.name ?? '',
          hospitalChainName:
            user.hospitalChainName ?? user.hospitalChain?.name ?? '',
        }}
      />
    </>
  );
}
