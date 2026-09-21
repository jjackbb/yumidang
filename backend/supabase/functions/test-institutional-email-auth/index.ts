import { createTestEmailAuthHandler } from './handler.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

Deno.serve(createTestEmailAuthHandler({
  url: Deno.env.get('SUPABASE_URL'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  enabled: Deno.env.get('TEST_INSTITUTIONAL_EMAIL_AUTH_ENABLED'),
  expiresAt: Deno.env.get('TEST_INSTITUTIONAL_EMAIL_AUTH_EXPIRES_AT'),
}));
