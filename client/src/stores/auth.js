import { writable } from 'svelte/store'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const initAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    user.set(session.user);
    // Check admin status
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();
    isAdmin.set(data?.is_admin || false);
  }
};

export const user = writable(null)
export const isAdmin = writable(false)

export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    
    // Get user profile with admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', data.user.id)
      .single()

    user.set(data.user)
    isAdmin.set(profile?.is_admin || false)
    
    return { user: data.user, isAdmin: profile?.is_admin || false }
  } catch (error) {
    console.error('Error signing in:', error.message)
    throw error
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    user.set(null)
    isAdmin.set(false)
  } catch (error) {
    console.error('Error signing out:', error.message)
    throw error
  }
}

// Initialize auth state
initAuth();

// Listen for auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    user.set(session.user);
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();
    isAdmin.set(data?.is_admin || false);
  } else if (event === 'SIGNED_OUT') {
    user.set(null);
    isAdmin.set(false);
  }
});
