'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, List, Settings, LogOut, User } from 'lucide-react';
import { DashboardHeader } from './components/DashboardHeader';
import { BottomNavigation } from './components/BottomNavigation';
import { SidebarNavigation } from './components/SidebarNavigation';
import { MobileMenu } from './components/MobileMenu';
import { CheckInTab } from './components/CheckInTab';
import { LogsTab } from '@/components/security/logs-tab/logs-tab';
import type { TabConfig } from './components/BottomNavigation';
import type { NavigationItem } from './components/SidebarNavigation';
import type { MenuItem } from './components/MobileMenu';
import { useAuthSession } from '@/hooks/useAuthSession';
import { DEMO_BRANCH_ID, IS_DEMO_MODE } from '@/lib/demo-config';
import { DemoRoleSwitcher } from '@/components/demo/DemoRoleSwitcher';

interface User {
  sub: string;
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  branchId?: string;
  branchName?: string;
  hospitalId?: string;
  hospitalChainName?: string;
  hospitalChain?: { name: string } | null;
  branch?: { name: string } | null;
}

const tabs: TabConfig[] = [
  {
    id: 'check-in',
    label: 'Check-In',
    icon: ClipboardCheck,
    ariaLabel: 'Check-In tab - Quick visitor check-in',
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: List,
    ariaLabel: 'Visitor Logs tab - View check-in records',
  },
];

const sidebarItems: NavigationItem[] = [
  {
    id: 'check-in',
    label: 'Quick Check-In',
    path: '/security/dashboard?tab=check-in',
    icon: ClipboardCheck,
  },
  {
    id: 'logs',
    label: 'Visitor Logs',
    path: '/security/dashboard?tab=logs',
    icon: List,
  },
];

export default function SecurityDashboard(): React.ReactElement {
  const router = useRouter();
  const sessionUser = useAuthSession<User>({ requiredRole: 'SECURITY' });
  const [activeTab, setActiveTab] = React.useState<'check-in' | 'logs'>('check-in');
  const [isMobile, setIsMobile] = React.useState(true);
  const [isLive, setIsLive] = React.useState(true);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const user = sessionUser;
  const authToken = IS_DEMO_MODE ? 'demo-mode' : (typeof window !== 'undefined' ? localStorage.getItem('authToken') ?? '' : '');

  const branchId = user?.branchId ?? DEMO_BRANCH_ID;

  // Handle responsive layout detection
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    // Check initial state
    checkMobile();

    // Debounced resize handler
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(checkMobile, 300);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  // Poll for live status (simulated)
  React.useEffect(() => {
    const checkLiveStatus = () => {
      // Simulate live status check - in production this would be an API call
      // GET /api/branches/:id/status
      setIsLive(true);
    };

    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (tab: 'check-in' | 'logs') => {
    setActiveTab(tab);
    // Announce tab change to screen readers
    const announcement = document.getElementById('tab-announcement');
    if (announcement) {
      announcement.textContent = `Navigated to ${tab === 'check-in' ? 'Check-In' : 'Visitor Logs'} tab`;
    }
  };

  const handleMenuToggle = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleLogout = () => {
    if (IS_DEMO_MODE) {
      router.push('/dashboard');
      return;
    }

    localStorage.removeItem('authToken');
    sessionStorage.clear();
    document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
    document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
    router.push('/auth/login');
  };

  const handleSidebarItemClick = (item: NavigationItem) => {
    if (item.id === 'check-in' || item.id === 'logs') {
      setActiveTab(item.id);
    }
  };

  const menuItems: MenuItem[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      action: () => { /* TODO: Navigate to profile page */ },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      action: () => { /* TODO: Navigate to settings page */ },
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: LogOut,
      action: handleLogout,
    },
  ];

  if (!user) {
    return <></>;
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Screen reader announcements */}
        <div
          id="tab-announcement"
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        />

        <DashboardHeader
          title="Security Dashboard"
          showHamburger={true}
          showLiveIndicator={true}
          onMenuClick={handleMenuToggle}
          isMenuOpen={isMenuOpen}
          liveStatus={isLive}
          actions={<DemoRoleSwitcher />}
        />

        <main
          className="flex-1 overflow-y-auto pt-16 pb-20"
          role="main"
          aria-label="Dashboard content"
        >
          {activeTab === 'check-in' ? (
            <CheckInTab branchId={branchId} />
          ) : (
            <LogsTab branchId={branchId} authToken={authToken} />
          )}
        </main>

        <BottomNavigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabs={tabs}
        />

        <MobileMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          items={menuItems}
          user={user ? {
            name: user.name,
            email: user.email,
            role: user.role,
            branchName: user.branchName ?? user.branch?.name,
            hospitalChainName: user.hospitalChainName ?? user.hospitalChain?.name,
          } : undefined}
        />
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="flex h-screen bg-background">
      {/* Screen reader announcements */}
      <div
        id="tab-announcement"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      <SidebarNavigation
        items={sidebarItems}
        activeItem={activeTab}
        onItemClick={handleSidebarItemClick}
        user={user ? {
          name: user.name,
          email: user.email,
          role: user.role,
          branchName: user.branchName ?? user.branch?.name,
          hospitalChainName: user.hospitalChainName ?? user.hospitalChain?.name,
        } : undefined}
        onLogout={handleLogout}
      />

      <main className="flex-1 lg:ml-64 p-6 overflow-y-auto" role="main" aria-label="Dashboard content">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header for desktop */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Security Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage visitor check-ins and view logs
              </p>
            </div>
            <div className="flex items-center gap-3">
              <DemoRoleSwitcher />
              <div
                className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-full border border-border"
                aria-live="polite"
              >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-muted-foreground">
                {isLive ? 'System Live' : 'Offline'}
              </span>
              </div>
            </div>
          </div>

          {/* Split Pane Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Check-In Panel */}
            <section
              className="bg-card rounded-lg border border-border shadow-sm"
              aria-labelledby="check-in-heading"
            >
              <div className="px-4 py-3 border-b border-border">
                <h2 id="check-in-heading" className="text-lg font-semibold text-card-foreground">
                  Quick Check-In
                </h2>
              </div>
              <div className="p-4">
                <CheckInTab branchId={branchId} />
              </div>
            </section>

            {/* Logs Panel */}
            <section
              className="bg-card rounded-lg border border-border shadow-sm"
              aria-labelledby="logs-heading"
            >
              <div className="px-4 py-3 border-b border-border">
                <h2 id="logs-heading" className="text-lg font-semibold text-card-foreground">
                  Visitor Logs
                </h2>
              </div>
              <div className="p-4">
                <LogsTab branchId={branchId} authToken={authToken} />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
