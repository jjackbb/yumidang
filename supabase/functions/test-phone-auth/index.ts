import { createTestAuthHandler } from './handler.ts';

// Deno's environment is server-side only; no service key belongs in VITE_* variables.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

Deno.serve(createTestAuthHandler({
  url: Deno.env.get('SUPABASE_URL'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  passwordSecret: Deno.env.get('TEST_PHONE_AUTH_SECRET'),
  enabled: Deno.env.get('TEST_PHONE_AUTH_ENABLED'),
  expiresAt: Deno.env.get('TEST_PHONE_AUTH_EXPIRES_AT'),
}));
