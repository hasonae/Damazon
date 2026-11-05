/**
 * Console routes and the department that unlocks each one.
 *
 * Access is declared per section rather than per screen so the guard has one
 * table to consult. The list is the console's mirror of the server's
 * department-to-permission map; the server remains authoritative, and a screen
 * the operator reaches here can still refuse the action (ADR-0006).
 */

import type { AdminDepartment } from '@damazon/shared-types';

export interface ConsoleSection {
  readonly path: string;
  readonly label: { readonly ar: string; readonly en: string };
  readonly departments: readonly AdminDepartment[];
}

export const CONSOLE_SECTIONS: readonly ConsoleSection[] = [
  {
    path: '/dashboard',
    label: { ar: 'لوحة المؤشرات', en: 'Dashboard' },
    departments: [
      'super_admin',
      'operations',
      'finance',
      'support',
      'marketing',
      'content',
      'moderation',
      'security',
    ],
  },
  {
    path: '/orders',
    label: { ar: 'الطلبات', en: 'Orders' },
    departments: ['super_admin', 'operations', 'support'],
  },
  {
    path: '/users',
    label: { ar: 'المستخدمون', en: 'Users' },
    departments: ['super_admin', 'operations', 'support', 'security'],
  },
  {
    path: '/audit-logs',
    label: { ar: 'سجلات التدقيق', en: 'Audit Logs' },
    departments: ['super_admin', 'operations', 'support', 'security'],
  },
  {
    path: '/drivers',
    label: { ar: 'السائقون', en: 'Drivers' },
    departments: ['super_admin', 'operations', 'support'],
  },
  {
    path: '/businesses',
    label: { ar: 'الشركات', en: 'Businesses' },
    departments: ['super_admin', 'operations', 'finance', 'marketing'],
  },
  {
    path: '/advertisements',
    label: { ar: 'الإعلانات', en: 'Advertisements' },
    departments: ['super_admin', 'marketing'],
  },
  {
    path: '/finance',
    label: { ar: 'المالية', en: 'Finance' },
    departments: ['super_admin', 'finance'],
  },
  {
    path: '/analytics',
    label: { ar: 'التقارير', en: 'Analytics' },
    departments: ['super_admin', 'operations', 'finance', 'marketing'],
  },
  {
    path: '/security',
    label: { ar: 'الأمان', en: 'Security' },
    departments: ['super_admin', 'security'],
  },
  {
    path: '/settings',
    label: { ar: 'الإعدادات', en: 'Settings' },
    departments: ['super_admin'],
  },
];

export function sectionForPath(pathname: string): ConsoleSection | null {
  return (
    CONSOLE_SECTIONS.find(
      (section) => pathname === section.path || pathname.startsWith(`${section.path}/`),
    ) ?? null
  );
}

export function isSectionAllowed(
  section: ConsoleSection,
  departments: readonly AdminDepartment[],
): boolean {
  return section.departments.some((department) => departments.includes(department));
}

export function visibleSections(
  departments: readonly AdminDepartment[],
): readonly ConsoleSection[] {
  return CONSOLE_SECTIONS.filter((section) => isSectionAllowed(section, departments));
}
