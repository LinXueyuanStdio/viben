// sessions:dangerous is intentionally not assigned to any named role.
// Only admin (via wildcard '*') has it. Operators must be explicitly granted it
// via custom scopes to prevent accidental bypass-permission escalation.
export const ROLES = {
  admin: ['*'],
  operator: [
    'sessions:read', 'sessions:write', 'sessions:prompt', 'sessions:permission',
    'agents:read', 'agents:write', 'commands:execute', 'system:health', 'config:read',
  ],
  viewer: ['sessions:read', 'agents:read', 'system:health'],
} as const;

// Known scopes — used for documentation and validation.
// sessions:dangerous grants access to destructive session operations.
// agents:write grants access to agent catalog management (e.g. reload).
export const KNOWN_SCOPES = [
  'sessions:read', 'sessions:write', 'sessions:prompt', 'sessions:permission', 'sessions:dangerous',
  'agents:read', 'agents:write', 'commands:execute', 'system:health', 'config:read',
] as const;

export type RoleName = keyof typeof ROLES;

/** Returns true if `role` is one of the known built-in role names. */
export function isValidRole(role: string): role is RoleName {
  return role in ROLES;
}

/** Returns the default scope list for a role, or an empty array for unknown roles. */
export function getRoleScopes(role: string): string[] {
  if (!isValidRole(role)) return [];
  return [...ROLES[role]];
}

/**
 * Returns true if `userScopes` contains `requiredScope`.
 *
 * The wildcard `'*'` short-circuits all checks — it is only granted to admin-type tokens.
 */
export function hasScope(userScopes: string[], requiredScope: string): boolean {
  if (userScopes.includes('*')) return true;
  return userScopes.includes(requiredScope);
}
