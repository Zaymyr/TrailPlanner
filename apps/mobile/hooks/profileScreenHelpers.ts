export function normalizeRoles(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

export function resolveIsAdminFromAuthUser(user: { app_metadata?: Record<string, unknown> | null } | null | undefined): boolean {
  const appMetadata = user?.app_metadata ?? null;
  const roles = normalizeRoles(appMetadata?.roles);
  const role = typeof appMetadata?.role === 'string' ? appMetadata.role : null;
  return role === 'admin' || roles.includes('admin');
}

export function formatDebugTimestamp(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatPushRegistrationDetails(details?: Record<string, unknown>): string | null {
  if (!details) return null;
  const entries = Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => {
    if (Array.isArray(value)) return `${key}=${value.join(', ')}`;
    if (typeof value === 'object') { try { return `${key}=${JSON.stringify(value)}`; } catch { return `${key}=[object]`; } }
    return `${key}=${String(value)}`;
  });
  return entries.length ? entries.join(' | ') : null;
}
