import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

export type AuthState = {
  status: 'loading' | 'authenticated' | 'anonymous' | 'error';
  user: User | null;
  error: string | null;
};

export const loadingAuth: AuthState = { status: 'loading', user: null, error: null };
const anonymousAuth: AuthState = { status: 'anonymous', user: null, error: null };

/** Validate restored tokens with Auth before exposing private UI. Never trust a stored user object. */
export function observeAuth(auth: SupabaseClient['auth'], emit: (state: AuthState) => void) {
  let disposed = false;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const publish = (state: AuthState) => { if (!disposed) emit(state); };
  const failed = () => publish({ status: 'error', user: null, error: '로그인 상태를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.' });
  const accept = (session: Session | null) => {
    const current = ++revision;
    clearTimeout(timer);
    if (!session) { publish(anonymousAuth); return; }
    publish(loadingAuth);
    timer = setTimeout(() => {
      if (disposed || current !== revision) return;
      revision++;
      failed();
    }, 12_000);
    // Do not await another Auth method inside onAuthStateChange's storage lock.
    void Promise.resolve().then(async () => {
      if (disposed || current !== revision) return;
      try {
        const { data, error } = await auth.getUser(session.access_token);
        if (disposed || current !== revision) return;
        clearTimeout(timer);
        if (error) {
          if (error.status === 401 || error.status === 403 || error.code === 'session_not_found' || error.code === 'user_not_found') publish(anonymousAuth);
          else failed();
          return;
        }
        publish(data.user && !data.user.is_anonymous
          ? { status: 'authenticated', user: data.user, error: null }
          : anonymousAuth);
      } catch {
        if (!disposed && current === revision) { clearTimeout(timer); failed(); }
      }
    });
  };

  publish(loadingAuth);
  const { data: { subscription } } = auth.onAuthStateChange((_event, session) => accept(session));
  const initialRevision = revision;
  timer = setTimeout(() => { if (revision === initialRevision) { revision++; failed(); } }, 12_000);
  void auth.getSession().then(({ data, error }) => {
    if (disposed || revision !== initialRevision) return;
    if (error) { clearTimeout(timer); failed(); }
    else accept(data.session);
  }).catch(() => {
    if (!disposed && revision === initialRevision) { clearTimeout(timer); failed(); }
  });
  return () => { disposed = true; revision++; clearTimeout(timer); subscription.unsubscribe(); };
}
