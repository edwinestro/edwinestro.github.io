/**
 * Fetches the current authenticated user from Azure SWA's built-in /.auth/me endpoint.
 * Returns { userId, userDetails, identityProvider } or null if unauthenticated.
 */
let _cached = null;

export async function getUser() {
  if (_cached !== undefined && _cached !== null) return _cached;

  try {
    const res = await fetch('/.auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    const principal = data.clientPrincipal;
    if (!principal || !principal.userId) return null;
    _cached = {
      userId: principal.userId,
      name: principal.userDetails || 'Player',
      provider: principal.identityProvider,
      roles: principal.userRoles || [],
    };
    return _cached;
  } catch {
    return null;
  }
}
