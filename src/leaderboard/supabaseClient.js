import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasRemoteConfig } from '../config.js';

/**
 * The Supabase client, created lazily so an app with no keys never loads it.
 *
 * expo-sqlite/localStorage/install is the shim Expo's own guide uses to give
 * supabase-js the `localStorage` it wants for session persistence - no
 * AsyncStorage adapter and no URL polyfill needed on SDK 54.
 */

let client = null;
let sessionPromise = null;

export const getClient = () => {
  if (!hasRemoteConfig()) return null;
  if (client) return client;

  try {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: globalThis.localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    client = null;
  }
  return client;
};

/**
 * Anonymous sign-in, once per launch. Must be enabled in the Supabase dashboard
 * (Authentication -> Sign In / Providers -> Anonymous); it is off by default and
 * every insert silently fails without it.
 */
export const ensureSession = async () => {
  const supabase = getClient();
  if (!supabase) return null;
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) return data.session;
      const { data: created, error } = await supabase.auth.signInAnonymously();
      if (error) return null;
      return created?.session || null;
    } catch (error) {
      return null;
    }
  })();

  const session = await sessionPromise;
  if (!session) sessionPromise = null; // let a later attempt retry
  return session;
};
