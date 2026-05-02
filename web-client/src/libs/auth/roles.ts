// Keep legacy/admin role spellings compatible across server seeds and Web client authz checks.
export const SYSTEM_ADMIN_ROLES = new Set([
  'system_admin',
  'admin',
  'system-admin',
  'system-administrator',
  'system_administrator',
]);

export const isSystemAdminRole = (role?: string) => {
  if (!role) return false;
  return SYSTEM_ADMIN_ROLES.has(role);
};

export const resolveSystemAdminRole = (role?: string, roles?: string[]) => {
  if (isSystemAdminRole(role)) return role;
  return roles?.find((entry) => isSystemAdminRole(entry));
};

export const hasSystemAdminRole = (role?: string, roles?: string[]) => Boolean(resolveSystemAdminRole(role, roles));
