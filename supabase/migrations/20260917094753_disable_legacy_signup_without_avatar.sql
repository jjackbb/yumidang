-- CONTRACTION: the avatar-required production client is live and its signup smoke passed.
-- Keep the function for rollback/operations, but prevent ordinary signed-in clients from bypassing the photo contract.
revoke execute on function public.complete_signup(text,date,text,text,text) from authenticated;

comment on function public.complete_signup(text,date,text,text,text)
  is 'Legacy no-avatar signup retained for rollback and service operations; authenticated client execution is revoked.';
