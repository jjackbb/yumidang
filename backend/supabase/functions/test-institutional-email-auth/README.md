# test-institutional-email-auth

Authenticated, test-only institutional-email eligibility check. No email is sent; the fixed code is `246810`.

The function must be deployed with JWT verification enabled and is additionally guarded by
`TEST_INSTITUTIONAL_EMAIL_AUTH_ENABLED=true` and a future ISO timestamp in
`TEST_INSTITUTIONAL_EMAIL_AUTH_EXPIRES_AT`. The browser never receives a service key, raw JWT,
or stored email record.
