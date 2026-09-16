export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  switch (code) {
    case 'phone_provider_disabled': return '휴대폰 로그인 서비스가 아직 준비되지 않았어요. 잠시 후 다시 이용해 주세요.';
    case 'otp_disabled': case 'signup_disabled': return '이 번호로 로그인할 수 없어요. 번호를 확인하거나 회원가입을 진행해 주세요.';
    case 'sms_send_failed': return '문자를 보내지 못했어요. 번호를 확인하고 다시 시도해 주세요.';
    case 'over_sms_send_rate_limit': case 'over_request_rate_limit': return '인증 요청이 많아요. 잠시 기다린 뒤 다시 시도해 주세요.';
    case 'otp_expired': case 'invalid_credentials': return '인증번호가 맞지 않거나 유효 시간이 지났어요. 확인하거나 새 번호를 요청해 주세요.';
    default: return '인증 요청을 완료하지 못했어요. 연결을 확인하고 다시 시도해 주세요.';
  }
}
