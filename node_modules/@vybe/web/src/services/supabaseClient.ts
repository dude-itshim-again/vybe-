import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://gjuluhdjfemmheuqossk.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqdWx1aGRqZmVtbWhldXFvc3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMDMwMjgsImV4cCI6MjEwODY3OTAyOH0.R5cSZRhPSHmbRplwAezdYo6qTUs-A4pmR-jhtTB3hG4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

export interface UserLibraryRow {
  user_id: string;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  liked_tracks?: any[];
  playlists?: any[];
  recently_played?: any[];
  last_played_track?: any | null;
  updated_at?: string;
}

/**
 * Fetches user library row from public.user_library where user_id = userId.
 * If no row exists yet, automatically inserts a fresh row for that user.
 */
export async function fetchUserLibrary(userId: string): Promise<UserLibraryRow | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_library')
      .select('liked_tracks, playlists, recently_played, last_played_track, display_name, avatar_url, email')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[SupabaseClient] fetchUserLibrary warning:', error.message);
      return null;
    }

    if (data) {
      return {
        user_id: userId,
        email: data.email || null,
        display_name: data.display_name || null,
        avatar_url: data.avatar_url || null,
        liked_tracks: Array.isArray(data.liked_tracks) ? data.liked_tracks : [],
        playlists: Array.isArray(data.playlists) ? data.playlists : [],
        recently_played: Array.isArray(data.recently_played) ? data.recently_played : [],
        last_played_track: data.last_played_track || null,
      };
    }

    // Insert fresh row if not found
    const freshRow: UserLibraryRow = {
      user_id: userId,
      email: null,
      display_name: null,
      avatar_url: null,
      liked_tracks: [],
      playlists: [],
      recently_played: [],
      last_played_track: null,
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase.from('user_library').insert(freshRow);
    if (insertError) {
      console.warn('[SupabaseClient] fresh row insert warning:', insertError.message);
    }
    return freshRow;
  } catch (err) {
    console.error('[SupabaseClient] fetchUserLibrary error:', err);
    return null;
  }
}

/**
 * Upserts library changes (liked_tracks, playlists, recently_played, last_played_track, updated_at)
 * to public.user_library in real time.
 */
export async function syncUserLibrary(
  userId: string,
  patch: Partial<UserLibraryRow>
): Promise<boolean> {
  if (!userId) return false;
  try {
    const payload = {
      user_id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_library')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.warn('[SupabaseClient] syncUserLibrary warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SupabaseClient] syncUserLibrary error:', err);
    return false;
  }
}

/**
 * Look up a user row in public.user_library by normalized email address.
 */
export async function fetchUserLibraryByEmail(email: string): Promise<UserLibraryRow | null> {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  try {
    const { data, error } = await supabase
      .from('user_library')
      .select('user_id, email, display_name, avatar_url, liked_tracks, playlists, recently_played, last_played_track, updated_at')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (error) {
      console.warn('[SupabaseClient] fetchUserLibraryByEmail notice:', error.message);
      return null;
    }

    if (data) {
      return {
        user_id: data.user_id,
        email: data.email || null,
        display_name: data.display_name || null,
        avatar_url: data.avatar_url || null,
        liked_tracks: Array.isArray(data.liked_tracks) ? data.liked_tracks : [],
        playlists: Array.isArray(data.playlists) ? data.playlists : [],
        recently_played: Array.isArray(data.recently_played) ? data.recently_played : [],
        last_played_track: data.last_played_track || null,
      };
    }
    return null;
  } catch (err) {
    console.error('[SupabaseClient] fetchUserLibraryByEmail error:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Verified Accounts Vault (vybe_accounts_db) for zero-SMTP verified authentication
// ---------------------------------------------------------------------------

export interface StoredAccountRecord {
  id: string;
  email: string; // normalized lower-cased
  displayName: string;
  passwordHash: string;
  createdAt: number;
}

export const ACCOUNTS_DB_KEY = 'vybe_accounts_db';

/**
 * Computes SHA-256 hash of password with internal application salt.
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password + '::vybe_auth_salt_2026');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {}
  }
  // Deterministic fallback if Web Crypto is unavailable
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  const salted = password + '::vybe_auth_salt_2026';
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Retrieves all stored accounts from vybe_accounts_db.
 */
export function getLocalAccounts(): Record<string, StoredAccountRecord> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(ACCOUNTS_DB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves or updates an account in vybe_accounts_db.
 */
export function saveLocalAccount(account: StoredAccountRecord): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const accounts = getLocalAccounts();
    accounts[account.email.toLowerCase()] = account;
    localStorage.setItem(ACCOUNTS_DB_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.warn('[SupabaseClient] Failed to save local account:', err);
  }
}

/**
 * Looks up a stored account from vybe_accounts_db by email.
 */
export function getLocalAccountByEmail(email: string): StoredAccountRecord | null {
  if (!email) return null;
  const accounts = getLocalAccounts();
  return accounts[email.trim().toLowerCase()] || null;
}

