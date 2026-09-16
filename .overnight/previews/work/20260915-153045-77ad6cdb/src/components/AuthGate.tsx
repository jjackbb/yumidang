import type { AuthState } from '../auth/session';

export function AuthGate({ status, error, onRetry, onLogin }: Pick<AuthState, 'status' | 'error'> & { onRetry: () => void; onLogin: () => void }) {
  return <section className="flex-1 p-8 pb-28 text-center space-y-4" aria-label="로그인 확인">
    <h2 className="text-lg font-bold">{status === 'loading' ? '로그인 상태를 확인하고 있어요' : status === 'error' ? '로그인 상태 확인이 필요해요' : '로그인이 필요해요'}</h2>
    <p role={status === 'error' ? 'alert' : 'status'} className="text-sm text-gray-600">{error || (status === 'loading' ? '잠시만 기다려 주세요.' : '로그인하면 요청한 화면으로 이동해요.')}</p>
    {status === 'error' && <button onClick={onRetry} className="rounded-xl bg-[#6c2cf5] text-white px-5 py-3 font-bold">다시 확인</button>}
    {status !== 'loading' && <button onClick={onLogin} className="block mx-auto text-sm text-[#6c2cf5] underline">로그인하기</button>}
  </section>;
}
