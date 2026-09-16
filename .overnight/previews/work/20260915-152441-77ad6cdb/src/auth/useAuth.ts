import { useCallback, useEffect, useState } from 'react';
import { supabase, supabaseConfigurationError } from '../lib/supabase';
import { loadingAuth, observeAuth, type AuthState } from './session';

export function useAuth(demoMode: boolean) {
  const [state, setState] = useState<AuthState>(loadingAuth);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (demoMode) { setState({ status: 'anonymous', user: null, error: null }); return; }
    if (!supabase) { setState({ status: 'error', user: null, error: supabaseConfigurationError }); return; }
    return observeAuth(supabase.auth, setState);
  }, [demoMode, attempt]);
  return { ...state, retry };
}
