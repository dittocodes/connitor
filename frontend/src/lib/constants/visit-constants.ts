export enum VisitCategory {
  MEETING = 'MEETING',
  DELIVERY = 'DELIVERY',
}

export const MEETING_SUB_TYPES = {
  MEDICAL_REPRESENTATIVE: {
    key: 'MEDICAL_REPRESENTATIVE',
    label: 'Medical Representative',
    description: 'Pharma, medical equipment, or healthcare products',
    icon: '💊',
  },
  SALES_MARKETING: {
    key: 'SALES_MARKETING',
    label: 'Sales & Marketing',
    description: 'Vendor sales, business proposals',
    icon: '📊',
  },
  SERVICE_MAINTENANCE: {
    key: 'SERVICE_MAINTENANCE',
    label: 'Service & Maintenance',
    description: 'AMC, equipment service, IT support',
    icon: '🔧',
  },
  CONSULTANT: {
    key: 'CONSULTANT',
    label: 'Consultant',
    description: 'External consultant, auditor, advisor',
    icon: '💼',
  },
  GENERAL_VISITOR: {
    key: 'GENERAL_VISITOR',
    label: 'General Visitor',
    description: 'Personal visit, interview, other',
    icon: '👤',
  },
} as const;

export const DELIVERY_SUB_TYPES = {
  PROFESSIONAL_GOODS: {
    key: 'PROFESSIONAL_GOODS',
    label: 'Professional Goods / Equipment',
    description: 'Medical supplies, equipment, scheduled deliveries',
    icon: '📦',
  },
  PACKAGE_COURIER: {
    key: 'PACKAGE_COURIER',
    label: 'Package / Courier / Documents',
    description: 'Amazon, Blue Dart, DTDC, courier packages',
    icon: '📬',
  },
  FOOD_DELIVERY: {
    key: 'FOOD_DELIVERY',
    label: 'Food Delivery',
    description: 'Swiggy, Zomato, Dominos',
    icon: '🍔',
  },
} as const;

export const DELIVERY_PLATFORMS = [
  'Swiggy',
  'Zomato',
  'Amazon',
  'Flipkart',
  'Blue Dart',
  'DTDC',
  'Delhivery',
  'Shadowfax',
  'Dunzo',
] as const;

export type MeetingSubTypeKey = keyof typeof MEETING_SUB_TYPES;
export type DeliverySubTypeKey = keyof typeof DELIVERY_SUB_TYPES;
export type DeliveryPlatform = (typeof DELIVERY_PLATFORMS)[number];

// Helper to check if a visitor profile is complete for meeting visits
export function isProfileCompleteForMeeting(visitor: {
  email?: string | null;
  company?: string | null;
  designation?: string | null;
}): boolean {
  return Boolean(visitor.email && visitor.company && visitor.designation);
}
