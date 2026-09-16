// Normal (non-demo) app: every screen reads and writes the designated Supabase project. No sample-data fallback.
import { useEffect, useState } from 'react';
import { useAppRoute } from '../auth/useAppRoute';
import { isProtectedPath, loginPath, safeReturnPath } from '../auth/routes';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { currentUserFromProfile } from '../auth/user';
import { getSupabaseClient } from '../lib/supabase';
import { AuthGate } from '../components/AuthGate';
import { AuthModal } from '../components/AuthModal';
import { BottomNav } from '../components/BottomNav';
import { Header } from '../components/Header';
import type { Post, PostFilters } from './api';
import { ChatRoom, ConversationList } from './Chat';
import { CreatePost } from './CreatePost';
import { MePage } from './MePage';
import { PostDetail } from './PostDetail';
import { emptyFilters, PostList } from './PostList';
import { ErrorBox, Skeleton } from './ui';

export default function LiveApp() {
  const auth = useSupabaseAuth(true);
  const { path, search, activeTab, setActiveTab, navigate } = useAppRoute();
  const [authOpen, setAuthOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const authenticated = auth.status === 'authenticated' && auth.user && auth.profile;
  const userId = authenticated ? auth.user!.id : null;

  useEffect(() => {
    const status = auth.status;
    if (isProtectedPath(path) && ['anonymous', 'profile-incomplete', 'error'].includes(status)) navigate(loginPath(path), true);
    if (path === '/login') {
      if (status === 'authenticated') { setAuthOpen(false); navigate(safeReturnPath(search.get('next')), true); }
      else if (status === 'anonymous' || status === 'profile-incomplete') setAuthOpen(true);
      else setAuthOpen(false);
    } else if (status === 'authenticated') setAuthOpen(false);
    if (status === 'profile-incomplete') setAuthOpen(true);
  }, [path, auth.status]);

  const closeAuth = () => { setAuthOpen(false); if (path === '/login') navigate('/', true); };
  const logout = async () => {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) { setLogoutError('로그아웃하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.'); return; }
    setLogoutError('');
    navigate('/', true);
  };

  return <div className="min-h-screen bg-[#f2f4f8] flex justify-center">
    <main className="w-full max-w-[440px] min-h-screen bg-white shadow-xl relative flex flex-col">
      <div role="status" className="bg-amber-50 px-4 py-2 text-xs text-amber-950 border-b border-amber-100">테스트 인증 단계예요. 인증번호 123456은 Supabase 서버가 검증하며 실제 문자는 발송되지 않고 번호 소유 확인도 아니에요.</div>
      <Header unreadCount={0} currentUser={authenticated ? currentUserFromProfile(auth.user!, auth.profile!) : null}
        onOpenNotifications={() => { if (!authenticated) setAuthOpen(true); else setActiveTab('chat'); }}
        onOpenAuth={() => setAuthOpen(true)} guestLabel={auth.status === 'profile-incomplete' ? '가입 계속' : '로그인'} />
      {logoutError && <div className="p-3"><ErrorBox message={logoutError} /></div>}
      {auth.status === 'error' && !isProtectedPath(path) && <div className="p-3"><ErrorBox message={auth.error || '로그인 상태를 확인하지 못했어요.'} onRetry={() => void auth.refresh()} /></div>}

      {/* Keyed by identity: switching accounts or logging out drops every private screen state.
          Nothing renders while the stored session is being restored, so a restore never remounts a screen the user already started using. */}
      {auth.status === 'loading' && <div aria-hidden="true" className="p-4"><Skeleton /></div>}
      {auth.status !== 'loading' && <Screens key={userId || 'anonymous'} userId={userId} profile={auth.profile} activeTab={activeTab} path={path} search={search}
        protectedGate={isProtectedPath(path) && !authenticated
          ? <AuthGate status={auth.status === 'error' ? 'error' : 'anonymous'} error={auth.error} onRetry={() => void auth.refresh()} onLogin={() => setAuthOpen(true)} />
          : null}
        navigate={navigate} onLoginRequired={() => setAuthOpen(true)} onLogout={logout} />}

      <AuthModal isOpen={authOpen} onClose={closeAuth} profileIncomplete={auth.status === 'profile-incomplete'} onProfileSaved={auth.refresh} />
    </main>
  </div>;
}

function Screens({ userId, profile, activeTab, path, search, protectedGate, navigate, onLoginRequired, onLogout }: {
  userId: string | null; profile: ReturnType<typeof useSupabaseAuth>['profile']; activeTab: string; path: string; search: URLSearchParams;
  protectedGate: React.ReactNode; navigate: (target: string, replace?: boolean) => void; onLoginRequired: () => void; onLogout: () => Promise<void>;
}) {
  const [filters, setFilters] = useState<PostFilters>(emptyFilters);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const room = path === '/chat' ? search.get('room') : null;
  const openChat = (requestId: string) => { setDetailId(null); navigate(`/chat?room=${encodeURIComponent(requestId)}`); };

  return <>
    {protectedGate}
    {!protectedGate && (activeTab === 'home' || activeTab === 'explore') && <PostList filters={filters} onChangeFilters={setFilters} onSelect={(post: Post) => setDetailId(post.id)} reloadKey={reloadKey} />}
    {!protectedGate && activeTab === 'chat' && userId && (room
      ? <ChatRoom key={room} requestId={room} userId={userId} onBack={() => navigate('/chat')} />
      : <ConversationList onOpen={openChat} />)}
    {!protectedGate && activeTab === 'me' && userId && profile && <MePage profile={profile} userId={userId} onOpenChat={openChat} onOpenPost={setDetailId} onLogout={onLogout} />}

    <BottomNav activeTab={activeTab as any} unreadChatCount={0} onChangeTab={tab => navigate(tab === 'home' ? '/' : `/${tab}`)}
      onOpenCreate={() => userId ? setCreating(true) : onLoginRequired()} />
    {detailId && <PostDetail postId={detailId} userId={userId} onClose={() => setDetailId(null)} onLoginRequired={onLoginRequired} onOpenChat={openChat} onChanged={() => setReloadKey(key => key + 1)} />}
    {creating && <CreatePost onClose={() => setCreating(false)} onCreated={post => { setCreating(false); setReloadKey(key => key + 1); setDetailId(post.id); }} />}
  </>;
}
