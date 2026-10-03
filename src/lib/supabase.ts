import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://hespppkftlslbcsizyur.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_8wuCVEEzGOAI3eRf6_8QQA_U6WjJICY'

export const supabase = createClient(supabaseUrl, supabaseKeyClean(supabaseAnonKey), {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})

function supabaseKeyClean(key: string): string {
  return key.trim()
}

/**
 * Send 6-digit OTP code to the provided email.
 * If isSignUp is false, shouldCreateUser is set to false so unknown users are blocked from signing in.
 */
export async function sendEmailOtp({
  email,
  isSignUp,
  name,
}: {
  email: string
  isSignUp: boolean
  name?: string
}) {
  const normalizedEmail = email.trim().toLowerCase()
  const { data, error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: isSignUp,
      data: name?.trim() ? { name: name.trim(), full_name: name.trim() } : undefined,
    },
  })
  if (error) throw error
  return data
}

/**
 * Verify 6-digit OTP code for the user's email.
 */
export async function verifyEmailOtp({
  email,
  token,
}: {
  email: string
  token: string
}) {
  const normalizedEmail = email.trim().toLowerCase()
  const cleanToken = token.trim()
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: cleanToken,
    type: 'email',
  })
  if (error) throw error
  return data
}

/**
 * Trigger Google OAuth sign-in via Supabase.
 * Uses window.location.origin so it automatically works across localhost and https://helpamart.com.
 */
export async function signInWithGoogle(nextPath = '/dashboard') {
  const cleanNext = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
  const redirectTo = `${window.location.origin}${cleanNext}`
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
  if (error) throw error
  return data
}

/**
 * Sign out of Supabase auth session.
 */
export async function signOutSupabase() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.warn('Supabase signOut warning:', error.message)
  }
}
