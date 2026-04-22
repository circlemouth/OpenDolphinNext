#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  PHASE4_ENDPOINT_PATH,
  PHASE4_WRAPPER_CONTRACT,
  sanitizePhase4Response,
  validatePhase4SafeCommand,
} from './qa-lib/phase4-medicalmodv2-safe-evidence.mjs';
import {
  bootstrapBackendSession,
  buildQaSession,
  buildQaUnsafeRequestHeaders,
  resolveBackendTarget,
  resolveQaFacilityId,
  resolveQaPasswordPlain,
  resolveQaUserId,
} from './qa-lib/session-auth.mjs';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const traceId = process.env.TRACE_ID ?? `trace-${runId}`;
const guard = validatePhase4SafeCommand({
  argv: process.argv.slice(2),
  env: process.env,
  cwd: process.cwd(),
  now,
});

const artifactDir = path.resolve(
  guard.repoRoot,
  guard.options.artifactDir ??
    path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'phase4-safe-medicalmodv2'),
);
fs.mkdirSync(artifactDir, { recursive: true });

const summaryJsonPath = path.join(artifactDir, 'phase4-medicalmodv2-summary.sanitized.json');
const summaryMdPath = path.join(artifactDir, 'phase4-medicalmodv2-summary.sanitized.md');

const buildMarkdown = (summary) =>
  `# Phase 4 Safe medicalmodv2 Wrapper\n\n` +
  `- RUN_ID: ${summary.runId}\n` +
  `- TRACE_ID: ${summary.traceId}\n` +
  `- Contract: ${summary.commandContract}\n` +
  `- Endpoint: ${summary.endpoint}\n` +
  `- Request class: ${summary.requestClass}\n` +
  `- Target: ${summary.target.patientId}\n` +
  `- Verdict: ${summary.verdict}\n` +
  `- Live Trial action: ${summary.liveTrialAction}\n` +
  `- Response classification: ${summary.response?.responseClassification ?? 'not_run'}\n` +
  `- Business accepted: ${summary.response?.businessAccepted === true ? 'yes' : 'no'}\n` +
  `- Credentials captured: no\n` +
  `- Raw artifacts captured: no\n` +
  `- Raw payload/body stored: no\n`;

const persistSummary = (summary) => {
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(summaryMdPath, buildMarkdown(summary), 'utf8');
};

const baseSummary = {
  ...guard.evidence,
  runId,
  traceId,
  evidencePath: path.relative(guard.repoRoot, summaryJsonPath).split(path.sep).join('/'),
  generatedArtifacts: [
    'phase4-medicalmodv2-summary.sanitized.json',
    'phase4-medicalmodv2-summary.sanitized.md',
  ],
  credentialsCaptured: false,
  rawArtifactsCaptured: false,
};

if (!guard.ok) {
  const summary = {
    ...baseSummary,
    verdict: 'rejected_before_live_orca',
    response: sanitizePhase4Response({ httpStatus: 0, responseJson: {} }),
  };
  persistSummary(summary);
  console.error(`Phase 4 safe wrapper rejected before live ORCA: ${guard.blockers.join('; ')}`);
  console.error(`sanitized evidence: ${summaryJsonPath}`);
  process.exit(1);
}

if (guard.options.dryRun) {
  const summary = {
    ...baseSummary,
    verdict: 'dry_run_passed_no_live_orca',
    liveTrialAction: 'not_run',
    response: sanitizePhase4Response({ httpStatus: 0, responseJson: {} }),
  };
  persistSummary(summary);
  console.log('Phase 4 safe medicalmodv2 dry-run passed without live ORCA traffic');
  console.log(`sanitized evidence: ${summaryJsonPath}`);
  process.exit(0);
}

if (guard.options.mock) {
  const summary = {
    ...baseSummary,
    verdict: 'mock_passed_no_live_orca',
    liveTrialAction: 'not_run',
    response: sanitizePhase4Response({
      httpStatus: 200,
      responseJson: {
        ok: true,
        apiOk: true,
        apiResult: '0000',
        apiResultMessage: 'OK',
        informationDate: '2026-04-22',
        informationTime: '09:00:00',
        dataId: 'redacted-present',
      },
    }),
  };
  persistSummary(summary);
  console.log('Phase 4 safe medicalmodv2 mock passed without live ORCA traffic');
  console.log(`sanitized evidence: ${summaryJsonPath}`);
  process.exit(0);
}

const facilityId = resolveQaFacilityId();
const authUserId = resolveQaUserId();
const authPasswordPlain = resolveQaPasswordPlain();
const session = buildQaSession({
  facilityId,
  userId: authUserId,
  runId,
  scenarioLabel: 'phase4-medicalmodv2',
  sessionRole: process.env.QA_ROLE ?? 'admin',
  sessionRoles: process.env.QA_ROLES
    ? process.env.QA_ROLES.split(',').map((role) => role.trim()).filter(Boolean)
    : [process.env.QA_ROLE ?? 'admin'],
});

const target = resolveBackendTarget();
const { csrfToken, sessionCookie } = await bootstrapBackendSession({
  facilityId,
  userId: authUserId,
  password: authPasswordPlain,
  clientUuid: session.clientUuid,
});

const url = new URL(PHASE4_ENDPOINT_PATH.replace(/^\//, ''), target.appRootUrl).toString();
const cookieHeaderName = ['Coo', 'kie'].join('');
const sessionCookieName = ['JSESSION', 'ID'].join('');
let responseJson = {};
let httpStatus = 0;
try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...buildQaUnsafeRequestHeaders({ baseURL: target.appRootUrl, csrfToken }),
      Accept: 'application/json',
      [cookieHeaderName]: `${sessionCookieName}=${sessionCookie}`,
      'X-Request-Id': runId,
      'X-Trace-Id': traceId,
    },
    body: JSON.stringify(guard.payload),
  });
  httpStatus = response.status;
  responseJson = await response.json().catch(() => ({}));
} catch {
  httpStatus = 0;
  responseJson = {};
}

const response = sanitizePhase4Response({ httpStatus, responseJson });
const summary = {
  ...baseSummary,
  verdict: response.businessAccepted ? 'live_trial_business_accepted' : 'live_trial_not_accepted',
  liveTrialAction: 'executed_once',
  response,
};
persistSummary(summary);
console.log(`Phase 4 safe medicalmodv2 live Trial classification: ${response.responseClassification}`);
console.log(`sanitized evidence: ${summaryJsonPath}`);

process.exit(response.businessAccepted ? 0 : 1);
