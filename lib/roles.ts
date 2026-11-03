// Roles and module access for the staff console. Safe to import in the browser.
export type Role = 'planner' | 'approver' | 'secretary' | 'lender' | 'admin';

// Which roles may open which module
export const ACCESS: Record<'planner' | 'society' | 'lender', Role[]> = {
  planner: ['planner', 'approver', 'admin'],
  society: ['secretary', 'admin'],
  lender: ['lender', 'admin'],
};
export const HOME_FOR: Record<Role, string> = { planner: '/planner', approver: '/planner', secretary: '/society', lender: '/lender', admin: '/planner' };
export const ROLE_LABEL: Record<Role, string> = { planner: 'Union planner', approver: 'Union approver', secretary: 'Society secretary', lender: 'Lender case officer', admin: 'Demo admin' };

