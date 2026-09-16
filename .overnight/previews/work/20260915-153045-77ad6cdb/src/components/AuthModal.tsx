import { usesPrototypeAuth } from '../utils/demoMode';
import { DemoAuthModal, type DemoAuthModalProps } from './DemoAuthModal';
import { SupabaseAuthModal } from './SupabaseAuthModal';
import type { AuthState } from '../auth/session';

export function AuthModal(props: DemoAuthModalProps & { auth: AuthState; onRetry: () => void }) {
  return usesPrototypeAuth() ? <DemoAuthModal {...props} /> : <SupabaseAuthModal {...props} />;
}
