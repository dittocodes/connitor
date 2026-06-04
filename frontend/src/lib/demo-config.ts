export const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/**
 * When true, all API calls are served from in-browser mock data (no backend).
 * Set NEXT_PUBLIC_USE_MOCK_API=true explicitly; demo mode alone still uses the real API.
 */
export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

export const DEMO_USER_ID_STORAGE_KEY = 'demoUserId';

export const DEFAULT_DEMO_USER_ID = '11111111-1111-1111-1111-111111111111';

export const DEMO_BRANCH_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

export type DemoRole =
  | 'SUPER_ADMIN'
  | 'CHAIN_ADMIN'
  | 'BRANCH_ADMIN'
  | 'SECURITY'
  | 'STAFF';

export interface DemoPersona {
  id: string;
  label: string;
  role: DemoRole;
  sub: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  hospitalChainId: string | null;
  branchId: string | null;
  hospitalChainName?: string;
  branchName?: string;
  hospitalChain: { name: string } | null;
  branch: { name: string } | null;
  userType?:
    | 'DOCTOR'
    | 'NURSE'
    | 'SURGEON'
    | 'RECEPTIONIST'
    | 'PHARMACIST'
    | 'LAB_TECHNICIAN'
    | 'DEPARTMENT_HEAD'
    | 'IT_SUPPORT'
    | null;
  department?:
    | 'IT_SUPPORT'
    | 'GENERAL_MEDICINE'
    | 'CARDIOLOGY'
    | 'NEUROLOGY'
    | 'ORTHOPEDICS'
    | 'RADIOLOGY'
    | 'PHARMACY'
    | 'ADMINISTRATION'
    | null;
  location?: string | null;
  createdAt?: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    label: 'Super Admin',
    role: 'SUPER_ADMIN',
    sub: '11111111-1111-1111-1111-111111111111',
    name: 'Sushobhit Kundra',
    email: 'superadmin@hvts.com',
    phone: '6987456321',
    isActive: true,
    hospitalChainId: null,
    branchId: null,
    hospitalChain: null,
    branch: null,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    label: 'Chain Admin',
    role: 'CHAIN_ADMIN',
    sub: '22222222-2222-2222-2222-222222222222',
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@apollohospitals.com',
    phone: '8482022111',
    isActive: true,
    hospitalChainId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    branchId: null,
    hospitalChainName: 'Apollo Hospitals',
    hospitalChain: { name: 'Apollo Hospitals' },
    branch: null,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    label: 'Branch Admin',
    role: 'BRANCH_ADMIN',
    sub: '33333333-3333-3333-3333-333333333333',
    name: 'Anil Patel',
    email: 'anil.patel@apollochennai.com',
    phone: '7980427511',
    isActive: true,
    hospitalChainId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    branchId: DEMO_BRANCH_ID,
    hospitalChainName: 'Apollo Hospitals',
    branchName: 'Apollo Hospitals (Chennai)',
    hospitalChain: { name: 'Apollo Hospitals' },
    branch: { name: 'Apollo Hospitals (Chennai)' },
  },
  {
    id: '99999999-9999-9999-9999-999999999999',
    label: 'Security',
    role: 'SECURITY',
    sub: '99999999-9999-9999-9999-999999999999',
    name: 'Rameshwar Tiwari',
    email: 'rameshwar.tiwari@apollochennai.com',
    phone: '9883578111',
    isActive: true,
    hospitalChainId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    branchId: DEMO_BRANCH_ID,
    hospitalChainName: 'Apollo Hospitals',
    branchName: 'Apollo Hospitals (Chennai)',
    hospitalChain: { name: 'Apollo Hospitals' },
    branch: { name: 'Apollo Hospitals (Chennai)' },
  },
  {
    id: '88888888-8888-8888-8888-888888888888',
    label: 'Staff (Doctor)',
    role: 'STAFF',
    sub: '88888888-8888-8888-8888-888888888888',
    name: 'Dr. Arjun Desai',
    email: 'arjun.desai@apollochennai.com',
    phone: '7003636111',
    isActive: true,
    hospitalChainId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    branchId: DEMO_BRANCH_ID,
    hospitalChainName: 'Apollo Hospitals',
    branchName: 'Apollo Hospitals (Chennai)',
    hospitalChain: { name: 'Apollo Hospitals' },
    branch: { name: 'Apollo Hospitals (Chennai)' },
    userType: 'DOCTOR',
    department: 'CARDIOLOGY',
    location: 'Room 101',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

/** @deprecated Use getDemoPersona() instead */
export const DEMO_USER = DEMO_PERSONAS[0];

export function getDemoPersonaById(id: string): DemoPersona {
  return DEMO_PERSONAS.find((persona) => persona.id === id) ?? DEMO_PERSONAS[0];
}

export function getStoredDemoUserId(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_DEMO_USER_ID;
  }

  return sessionStorage.getItem(DEMO_USER_ID_STORAGE_KEY) ?? DEFAULT_DEMO_USER_ID;
}

export function getDemoPersona(): DemoPersona {
  return getDemoPersonaById(getStoredDemoUserId());
}

export function getDemoHomePath(role: string): string {
  switch (role) {
    case 'SECURITY':
      return '/security/dashboard';
    case 'STAFF':
      return '/dashboard/my-visitors';
    default:
      return '/dashboard';
  }
}
