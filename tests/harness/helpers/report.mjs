// Step recorder, leak-safe evidence writer and STATE.md renderer.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';

export const IMPL_DIR = path.join(ROOT, 'docs/development/backend-implementation');
export const STATE_JSON = path.join(IMPL_DIR, 'state.json');
const STATE_MD = path.join(IMPL_DIR, 'STATE.md');

export const FEATURES = [
  ['preflight', '사전 검사', 'npm run harness:preflight'],
  ['feature-01-auth', '기능 1 회원가입', 'npm run harness:01'],
  ['feature-02-login', '기능 2 로그인', 'npm run harness:02'],
  ['feature-03-posts', '기능 3 공고', 'npm run harness:03'],
  ['feature-04-profile', '기능 4 상대 프로필', 'npm run harness:04'],
  ['feature-05-requests', '기능 5 참여 요청', 'npm run harness:05'],
  ['feature-06-chat', '기능 6 매칭 채팅', 'npm run harness:06'],
  ['feature-07-match', '기능 7 최종 확정', 'npm run harness:07'],
  ['feature-08-completion', '기능 8 동행 완료', 'npm run harness:08'],
  ['feature-09-reviews', '기능 9 상호 평가', 'npm run harness:09'],
  ['full-cycle', 'A/B/C 두 브라우저 전체 사이클', 'npm run harness:full-cycle'],
];

export function newRunId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  return `run-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Values that must never reach evidence or console output. */
export function createGuard() {
  const secrets = new Set();
  return {
    protect(...values) { for (const value of values) if (value && String(value).length >= 2) secrets.add(String(value)); },
    scan(text) {
      const problems = [];
      if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(text)) problems.push('jwt');
      if (/sb_secret_|service_role/i.test(text)) problems.push('secret key');
      if (/(?:\+82|\b0)1\d[- ]?\d{3,4}[- ]?\d{4}\b/.test(text)) problems.push('phone number');
      for (const value of secrets) if (text.includes(value)) problems.push('protected value');
      return problems;
    },
  };
}

export function createRun({ runId = process.env.HARNESS_RUN_ID || newRunId() } = {}) {
  const evidenceDir = path.join(IMPL_DIR, 'evidence', runId);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guard = createGuard();
  const results = {};

  const writeEvidence = (name, payload) => {
    const file = path.join(evidenceDir, `${name}.json`);
    if (fs.existsSync(file)) throw new Error(`evidence already exists: ${file}`);
    const text = JSON.stringify(payload, null, 2);
    const problems = guard.scan(text);
    if (problems.length) throw new Error(`evidence ${name} blocked: contains ${[...new Set(problems)].join(', ')}`);
    fs.writeFileSync(file, text + '\n');
    return path.relative(ROOT, file);
  };

  const feature = (key) => {
    const record = { key, status: 'running', steps: [], startedAt: new Date().toISOString() };
    results[key] = record;
    saveState({ runId, results });
    return {
      record,
      /** layer: LOCAL | REMOTE | BROWSER */
      async step(name, layer, fn) {
        const started = Date.now();
        try {
          const detail = await fn();
          record.steps.push({ name, layer, result: 'PASS', ms: Date.now() - started, ...(detail && typeof detail === 'object' ? { detail } : {}) });
          console.log(`  PASS [${layer}] ${name}`);
        } catch (error) {
          const message = String(error?.message || error).slice(0, 400);
          const safe = guard.scan(message).length ? 'error text withheld (contained protected data)' : message;
          record.steps.push({ name, layer, result: 'FAIL', ms: Date.now() - started, error: safe });
          console.log(`  FAIL [${layer}] ${name}: ${safe}`);
          throw Object.assign(new Error(`${key} › ${name}: ${safe}`), { harnessStep: name });
        }
      },
      notRun(name, layer, reason) {
        record.steps.push({ name, layer, result: 'NOT_RUN', reason });
        console.log(`  NOT_RUN [${layer}] ${name}: ${reason}`);
      },
      finish(status, failure) {
        record.status = status;
        record.finishedAt = new Date().toISOString();
        if (failure) record.failure = failure;
        const passed = record.steps.filter(item => item.result === 'PASS');
        record.lastPassedStep = passed.at(-1)?.name || null;
        record.evidence = writeEvidence(key, record);
        saveState({ runId, results });
      },
    };
  };

  return { runId, evidenceDir, guard, results, feature, writeEvidence };
}

function saveState({ runId, results }) {
  fs.mkdirSync(IMPL_DIR, { recursive: true });
  let state = { features: {} };
  try { state = JSON.parse(fs.readFileSync(STATE_JSON, 'utf8')); } catch {}
  state.features ||= {};
  for (const [key, record] of Object.entries(results)) {
    state.features[key] = {
      status: record.status, runId, updatedAt: record.finishedAt || record.startedAt,
      lastPassedStep: record.lastPassedStep ?? null, failure: record.failure || null, evidence: record.evidence || null,
      counts: countSteps(record.steps),
    };
  }
  state.lastRunId = runId;
  fs.writeFileSync(STATE_JSON, JSON.stringify(state, null, 2) + '\n');
  fs.writeFileSync(STATE_MD, renderState(state));
}

const countSteps = steps => steps.reduce((acc, item) => ({ ...acc, [item.result]: (acc[item.result] || 0) + 1 }), {});

function renderState(state) {
  const rows = FEATURES.map(([key, label, command]) => {
    const item = state.features[key];
    const counts = item?.counts ? Object.entries(item.counts).map(([k, v]) => `${k} ${v}`).join(', ') : '';
    return `| ${label} | \`${item?.status || 'pending'}\` | ${item?.runId || '-'} | ${counts || '-'} | ${item?.lastPassedStep || '-'} | ${item?.failure ? item.failure.replace(/\|/g, '/') : '-'} | \`${command}\` |`;
  });
  const firstOpen = FEATURES.find(([key]) => state.features[key]?.status !== 'pass');
  return `# 구현 하네스 상태

자동 생성 파일이다. 직접 수정하지 말고 하네스를 실행한다. 상태 값: \`pending\`, \`running\`, \`pass\`, \`fail\`, \`not_run\`.

- 마지막 run: \`${state.lastRunId || '-'}\`
- 재개 지점: ${firstOpen ? `${firstOpen[1]} → \`${firstOpen[2]}\`` : '모든 단계 pass — 회귀는 `npm run test:harness`'}

| 단계 | 상태 | run_id | 단계 결과 | 마지막 통과 단계 | 실패 원인 | 재실행 명령 |
|---|---|---|---|---|---|---|
${rows.join('\n')}

증거는 \`docs/development/backend-implementation/evidence/<run_id>/\`에 run별로 저장되며 기존 파일을 덮어쓰지 않는다.
`;
}
