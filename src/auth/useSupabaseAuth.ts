import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from '../lib/supabase.ts';
import type { SignupProfile } from './signup.ts';

export type SupabaseAuthStatus = 'disabled' | 'loading' | 'anonymous' | 'profile-incomplete' | 'authenticated' | 'error';

interface SupabaseAuthState {
  status: SupabaseAuthStatus;
  session: Session | null;
  user: User | null;
  profile: SignupProfile | null;
  error: string | null;
}

const disabledState: SupabaseAuthState = { status: 'disabled', session: null, user: null, profile: null, error: null };
const loadingState: SupabaseAuthState = { status: 'loading', session: null, user: null, profile: null, error: null };

export function useSupabaseAuth(enabled: boolean) {
  const [state, setState] = useState<SupabaseAuthState>(enabled ? loadingState : disabledState);

  const syncSession = useCallback(async (session: Session | null) => {
    if (!enabled) return;
    if (!session) {
      setState({ status: 'anonymous', session: null, user: null, profile: null, error: null });
      return;
    }

    setState(previous => ({ ...previous, status: 'loading', session, user: session.user, error: null }));
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('id,nickname,birth_date,avatar_url,bio,created_at,updated_at')
        .eq('id', session.user.id)
        .maybeSingle<SignupProfile>();
      if (error) throw error;
      setState({
        status: data ? 'authenticated' : 'profile-incomplete',
        session,
        user: session.user,
        profile: data,
        error: null,
      });
    } catch (error) {
      setState({
        status: 'error',
        session,
        user: session.user,
        profile: null,
        error: error instanceof Error ? error.message : '가입 상태를 확인하지 못했어요.',
      });
    }
  }, [enabled]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      await syncSession(data.session);
    } catch (error) {
      setState(previous => ({
        ...previous,
        status: 'error',
        error: error instanceof Error ? error.message : '가입 상태를 확인하지 못했어요.',
      }));
    }
  }, [enabled, syncSession]);

  useEffect(() => {
    if (!enabled) {
      setState(disabledState);
      return;
    }

    let active = true;
    let unsubscribe = () => {};
    try {
      const supabase = getSupabaseClient();
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        return syncSession(data.session);
      }).catch(error => {
        if (active) setState({ status: 'error', session: null, user: null, profile: null, error: error instanceof Error ? error.message : '가입 상태를 확인하지 못했어요.' });
      });
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) void syncSession(session);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch (error) {
      setState({ status: 'error', session: null, user: null, profile: null, error: error instanceof Error ? error.message : 'Supabase 설정을 확인해 주세요.' });
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled, syncSession]);

  return { ...state, refresh };
}
