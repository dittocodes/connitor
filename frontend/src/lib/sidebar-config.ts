export const sidebarConfig = {
  SUPER_ADMIN: [
    { label: 'Overview', href: '/dashboard', icon: 'dashboard' },
    {
      label: 'Hospital Chains',
      href: '/dashboard/hospital-chains',
      icon: 'hospital',
    },
    { label: 'Branches', href: '/dashboard/branches', icon: 'building' },
    { label: 'Departments', href: '/dashboard/departments', icon: 'layers' },
    { label: 'Sub-Departments', href: '/dashboard/sub-departments', icon: 'git-branch' },
    { label: 'Users', href: '/dashboard/users', icon: 'users' },
    { label: 'Appointments', href: '/dashboard/appointments', icon: 'calendar' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
  ],
  HOSPITAL_ADMIN: [
    { label: 'Overview', href: '/dashboard', icon: 'dashboard' },
    { label: 'Departments', href: '/dashboard/departments', icon: 'layers' },
    { label: 'Sub-Departments', href: '/dashboard/sub-departments', icon: 'git-branch' },
    { label: 'Users', href: '/dashboard/users', icon: 'users' },
    { label: 'Visitors', href: '/dashboard/visitors', icon: 'user-plus' },
    { label: 'Appointments', href: '/dashboard/appointments', icon: 'calendar' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
  ],
  DEPARTMENT_ADMIN: [
    { label: 'Overview', href: '/dashboard', icon: 'dashboard' },
    { label: 'Sub-Departments', href: '/dashboard/sub-departments', icon: 'git-branch' },
    { label: 'Users', href: '/dashboard/users', icon: 'users' },
    { label: 'Appointments', href: '/dashboard/appointments', icon: 'calendar' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
  ],
  SUB_DEPARTMENT_ADMIN: [
    { label: 'Overview', href: '/dashboard', icon: 'dashboard' },
    { label: 'Staff', href: '/dashboard/users', icon: 'users' },
    { label: 'Appointments', href: '/dashboard/appointments', icon: 'calendar' },
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
    {
      label: 'Quick Check-In',
      href: '/security/dashboard?tab=check-in',
      icon: 'user-plus',
    },
    {
      label: "Today's Appointments",
      href: '/security/dashboard?tab=appointments',
      icon: 'calendar',
    },
    {
      label: 'Visitor Logs',
      href: '/security/dashboard?tab=logs',
      icon: 'book',
    },
    { label: 'All Appointments', href: '/dashboard/appointments', icon: 'calendar' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
  ],
  SECURITY_SUPERVISOR: [
    {
      label: 'Quick Check-In',
      href: '/security/dashboard?tab=check-in',
      icon: 'user-plus',
    },
    {
      label: "Today's Appointments",
      href: '/security/dashboard?tab=appointments',
      icon: 'calendar',
    },
    {
      label: 'Visitor Logs',
      href: '/security/dashboard?tab=logs',
      icon: 'book',
    },
    { label: 'All Appointments', href: '/dashboard/appointments', icon: 'calendar' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
  ],
  STAFF: [
    { label: 'Overview', href: '/dashboard', icon: 'dashboard' },
    { label: 'My Appointments', href: '/dashboard/my-visitors', icon: 'users' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
  ],
};
