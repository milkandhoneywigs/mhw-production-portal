import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { Profile } from './types';
import type { Role } from './constants';

// Returns the signed-in user's profile, or null if not signed in.
export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  return (data as Profile) ?? null;
}

// Require a signed-in user; redirect to /login otherwise. Returns the profile.
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  return profile;
}

// Require one of the given roles. Redirects appropriately if not allowed.
export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    // suppliers who reach an internal page get bounced to their own dashboard.
    redirect(profile.role === 'supplier' ? '/supplier' : '/dashboard');
  }
  return profile;
}

export const requireStaff = () => requireRole(['admin', 'staff']);
export const requireAdmin = () => requireRole(['admin']);

export async function requireSupplier(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== 'supplier' || !profile.supplier_id) {
    // non-suppliers (or misconfigured suppliers) go to the internal dashboard.
    redirect('/dashboard');
  }
  return profile;
}

export const isStaff = (p: Profile | null) => p?.role === 'admin' || p?.role === 'staff';
export const isAdmin = (p: Profile | null) => p?.role === 'admin';
