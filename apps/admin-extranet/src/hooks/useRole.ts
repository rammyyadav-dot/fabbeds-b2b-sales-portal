import { useAppAuth } from '@/hooks/useAppAuth';

export type DmcRole =
  | 'Admin'
  | 'Contracting Team'
  | 'Sales Manager'
  | 'Finance Controller'
  | 'Reservations Agent'
  | 'Read Only';

export type AppRole = DmcRole;

export const DMC_ROLES: DmcRole[] = [
  'Admin',
  'Contracting Team',
  'Sales Manager',
  'Finance Controller',
  'Reservations Agent',
  'Read Only',
];

export const ROLE_ACCESS: Record<DmcRole, string[]> = {
  'Admin':               ['*'],
  'Contracting Team': ['/hotels', '/markup-rules', '/rate-sheet', '/rate-sync', '/quick-update', '/reservations', '/bookings'],
  'Sales Manager':       ['/rate-sheet', '/reservations', '/bookings', '/mice', '/markup-rules'],
  'Finance Controller':  ['/financial-reports', '/reservations', '/bookings'],
  'Reservations Agent':  ['/reservations', '/bookings', '/mice'],
  'Read Only':           ['/'],
};

export function useRole() {
  const { user, isLoading } = useAppAuth();

  // Support comma-separated multi-role values (e.g. "Sales Manager,Finance Controller")
  const rawRole = (user?.role ?? 'Read Only') as string;
  const roles = rawRole.split(',').map(r => r.trim()) as DmcRole[];
  const role: DmcRole = roles[0] ?? 'Read Only'; // primary role
  const isAdmin = roles.includes('Admin');

  const canAccess = (path: string): boolean => {
    if (isAdmin) return true;
    if (path === '/') return true;
    return roles.some(r => {
      const allowed = ROLE_ACCESS[r] ?? [];
      return allowed.some(p => p === '*' || path.startsWith(p));
    });
  };

  return { role, roles, isAdmin, canAccess, isLoading };
}
