import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationPath = new URL('../../backend/supabase/migrations/20260917122744_ut_notifications_and_discovery.sql', import.meta.url);
const sql = readFileSync(migrationPath, 'utf8');
const indexMigrationPath = new URL('../../backend/supabase/migrations/20260917141449_notifications_join_request_index.sql', import.meta.url);
const indexSql = readFileSync(indexMigrationPath, 'utf8');

test('UT notification migration is additive, recipient-scoped and least-privileged', () => {
  assert.match(sql, /create table public\.notifications/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /recipient_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /revoke all on table public\.notifications from public, anon, authenticated/i);
  assert.match(sql, /grant select on table public\.notifications to authenticated/i);
  assert.match(sql, /after insert on public\.join_requests/i);
  assert.match(sql, /on conflict .* do nothing/i);
  assert.match(sql, /mark_my_notification_read/i);
  assert.match(sql, /mark_all_my_notifications_read/i);
  assert.match(sql, /get_post_author_discovery_cards/i);
  assert.doesNotMatch(sql, /\b(drop table|truncate|delete from|update public\.(profiles|posts|join_requests|chat_messages|appointments|appointment_reviews))\b/i);
});

test('notification migration never backfills historical join requests', () => {
  assert.equal((sql.match(/insert into public\.notifications/gi) || []).length, 1, 'only the new-row trigger may insert notifications');
  assert.doesNotMatch(sql, /from public\.join_requests/i);
  assert.match(sql, /after insert on public\.join_requests/i);
  assert.match(sql, /Notifications begin with join requests inserted after this migration is applied/i);
});

test('discovery RPC never selects private source fields into its return contract', () => {
  const signature = sql.match(/get_post_author_discovery_cards[\s\S]*?returns table \(([^)]+)\)/i)?.[1] || '';
  assert.match(signature, /masked_name text/);
  assert.match(signature, /gender text/);
  assert.match(signature, /age integer/);
  assert.doesNotMatch(signature, /birth_date|phone|exact_location/);
});

test('notification foreign key has a forward-only covering index migration', () => {
  assert.match(indexSql, /create index notifications_join_request_idx\s+on public\.notifications \(join_request_id\)/i);
  assert.doesNotMatch(indexSql, /\b(drop|truncate|delete|update|insert)\b/i);
});
