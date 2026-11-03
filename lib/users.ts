import type { Role } from './roles';

// Demo accounts for the staff console. Shown on the sign-in page; not for real use.
export const DEMO_USERS: { username: string; password: string; name: string; role: Role }[] = [
  { username: 'planner', password: 'planner123', name: 'Union planner', role: 'planner' },
  { username: 'approver', password: 'approver123', name: 'Union approver', role: 'approver' },
  { username: 'secretary', password: 'society123', name: 'Society secretary', role: 'secretary' },
  { username: 'lender', password: 'lender123', name: 'Lender case officer', role: 'lender' },
  { username: 'admin', password: 'admin123', name: 'Demo admin', role: 'admin' },
];
