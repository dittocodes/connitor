export const sidebarConfig = {
  SUPER_ADMIN: [
    { label: 'Overview', href: '/dashboard', icon: 'dashboard' },
    {
      label: 'Hospital Chains',
      href: '/dashboard/hospital-chains',
      icon: 'hospital',
    },
    { label: 'Branches', href: '/dashboard/branches', icon: 'building' },
    { label: 'Users', href: '/dashboard/users', icon: 'users' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
  ],
  CHAIN_ADMIN: [
    { label: 'Overview', href: '/dashboard', icon: 'dashboard' },
    {
      label: 'Branches',
      href: '/dashboard/branches',
      icon: 'building',
    },
    { label: 'Users', href: '/dashboard/users', icon: 'users' },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: 'settings',
    },
  ],
  BRANCH_ADMIN: [
    { label: 'Overview', href: '/dashboard', icon: 'dashboard' },
    { label: 'Users', href: '/dashboard/users', icon: 'users' },
    { label: 'Visitors', href: '/dashboard/visitors', icon: 'user-plus' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
  ],
  SECURITY: [
    { label: 'Overview', href: '/dashboard', icon: 'dashboard' },
    {
      label: 'Check-In Visitors',
      href: '/dashboard/visitors/check-in',
      icon: 'user-plus',
    },
    {
      label: 'Visitors Logs',
      href: '/dashboard/visitors/visitors-logs',
      icon: 'book',
    },
    { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
  ],
  STAFF: [
    { label: 'Overview', href: '/dashboard', icon: 'dashboard' },
    { label: 'My Visitors', href: '/dashboard/my-visitors', icon: 'users' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
  ],
};
