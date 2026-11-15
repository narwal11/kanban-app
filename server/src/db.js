import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set')
}

const serverAuthOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
}

// Anonymous client: RLS applies as the `anon` role.
export const publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: serverAuthOptions,
})

// Per-request client: every query carries the user's JWT, so RLS applies as that user.
export function clientForToken(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: serverAuthOptions,
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

// Returns the user for a valid access token, or null.
export async function verifyToken(token) {
  if (!token) return null
  const { data, error } = await publicClient.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}
