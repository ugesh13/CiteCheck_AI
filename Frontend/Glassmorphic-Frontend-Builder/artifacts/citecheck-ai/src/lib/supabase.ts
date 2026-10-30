import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { api } from './api/endpoints';

let supabaseInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

// Built-in public project credentials (URL & public anon key only)
// NEVER include service-role keys here.
const DEFAULT_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://ysoefzaftbpkagqpqyoc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzb2VmemFmdGJwa2FncXBxeW9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNjU1MDQsImV4cCI6MjEwODY0MTUwNH0.ER2RC6UL2xpGdaZ9zZsvdbtX12nYJb2nicmvHDfdLzA';

export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  try {
    if (DEFAULT_SUPABASE_URL && DEFAULT_SUPABASE_ANON_KEY) {
      supabaseInstance = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      return supabaseInstance;
    }
  } catch (err) {
    console.warn('Failed to initialize Supabase client synchronously:', err);
  }
  return null;
}

export async function initSupabase(): Promise<SupabaseClient | null> {
  if (supabaseInstance) return supabaseInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Try environment variables / defaults first
      if (DEFAULT_SUPABASE_URL && DEFAULT_SUPABASE_ANON_KEY) {
        supabaseInstance = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        return supabaseInstance;
      }

      // 2. Fetch public auth config from backend bridge
      const config = await api.authConfig().catch(() => null);
      if (config?.supabase_url && config?.supabase_anon_key) {
        supabaseInstance = createClient(config.supabase_url, config.supabase_anon_key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        return supabaseInstance;
      }
    } catch (err) {
      console.warn('Could not initialize Supabase client:', err);
    }
    return null;
  })();

  return initPromise;
}
