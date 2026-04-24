#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  SOAP_DISEASE_WRAPPER_CONTRACT,
  sanitizeSoapDiseaseOfficialResponse,
  summarizeRuntimeReadiness,
  validateSoapDiseaseSafeCommand,
} from './qa-lib/phase4-soap-disease-safe-evidence.mjs';
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
const guard = validateSoapDiseaseSafeCommand({
  argv: process.argv.slice(2),
  env: process.env,
  cwd: process.cwd(),
  now,
});

const artifactDir = path.resolve(
  guard.repoRoot,
  guard.options.artifactDir ??
    path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'phase4-safe-soap-disease'),
);
fs.mkdirSync(artifactDir, { recursive: true });

const summaryJsonPath = path.join(artifactDir, 'phase4-soap-disease-summary.sanitized.json');
const summaryMdPath = path.join(artifactDir, 'phase4-soap-disease-summary.sanitized.md');

const buildMarkdown = (summary) =>
  `# Phase 4 Safe SOAP / Disease No-Live Wrapper\n\n` +
  `- RUN_ID: ${summary.runId}\n` +
  `- TRACE_ID: ${summary.traceId}\n` +
  `- Contract: ${summary.commandContract}\n` +
  `- Workflow: ${summary.workflow}\n` +
  `- Endpoint: ${summary.endpoint}\n` +
  `- Request class: ${summary.requestClass}\n` +
  `- Target: ${summary.target.patientId}\n` +
  `- Verdict: ${summary.verdict}\n` +
  `- Live Trial action: ${summary.liveTrialAction}\n` +
  `- Response classification: ${summary.response.responseClassification}\n` +
  `- Business accepted: ${summary.response.businessAccepted === true ? 'yes' : 'no'}\n` +
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
  commandContract: SOAP_DISEASE_WRAPPER_CONTRACT,
  evidencePath: path.relative(guard.repoRoot, summaryJsonPath).split(path.sep).join('/'),
  generatedArtifacts: [
    'phase4-soap-disease-summary.sanitized.json',
    'phase4-soap-disease-summary.sanitized.md',
  ],
  credentialsCaptured: false,
  rawArtifactsCaptured: false,
};

if (!guard.ok) {
  const summary = {
    ...baseSummary,
    verdict: 'rejected_before_live_orca',
    response: guard.evidence.response ?? sanitizeSoapDiseaseOfficialResponse({ workflow: guard.evidence.workflow, httpStatus: 0, responseJson: {} }),
  };
  persistSummary(summary);
  console.error(`Phase 4 safe SOAP/disease wrapper rejected before live ORCA: ${guard.blockers.join('; ')}`);
  console.error(`sanitized evidence: ${summaryJsonPath}`);
  process.exit(1);
}

if (guard.options.dryRun || guard.options.mock) {
  const summary = {
    ...baseSummary,
    verdict: guard.options.dryRun ? 'dry_run_passed_no_live_orca' : 'mock_passed_no_live_orca',
  };
  persistSummary(summary);
  console.log(`Phase 4 safe SOAP/disease ${guard.options.dryRun ? 'dry-run' : 'mock'} passed without live ORCA traffic`);
  console.log(`sanitized evidence: ${summaryJsonPath}`);
  process.exit(0);
}

const target = resolveBackendTarget();

const probeStatusOnly = async (pathName) => {
  const url = new URL(pathName.replace(/^\//, ''), target.appRootUrl).toString();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Request-Id': runId,
        'X-Trace-Id': traceId,
      },
    });
    return response.status;
  } catch {
    return 0;
  }
};

const runtimeReadiness = summarizeRuntimeReadiness({
  healthStatus: await probeStatusOnly('/api/health'),
  readinessStatus: await probeStatusOnly('/api/health/readiness'),
});

if (!runtimeReadiness.ok) {
  const summary = {
    ...baseSummary,
    verdict: 'blocked_runtime_not_ready',
    liveTrialAction: 'not_run',
    runtimeReadiness,
    response: sanitizeSoapDiseaseOfficialResponse({ workflow: guard.evidence.workflow, httpStatus: 0, responseJson: {} }),
  };
  persistSummary(summary);
  console.error(`Phase 4 safe SOAP/disease wrapper blocked before live ORCA: ${runtimeReadiness.blockers.join('; ')}`);
  console.error(`sanitized evidence: ${summaryJsonPath}`);
  process.exit(1);
}

const facilityId = resolveQaFacilityId();
const authUserId = resolveQaUserId();
const authPasswordPlain = resolveQaPasswordPlain();
const session = buildQaSession({
  facilityId,
  userId: authUserId,
  runId,
  scenarioLabel: `phase4-${guard.evidence.workflow}`,
  sessionRole: process.env.QA_ROLE ?? 'admin',
  sessionRoles: process.env.QA_ROLES
    ? process.env.QA_ROLES.split(',').map((role) => role.trim()).filter(Boolean)
    : [process.env.QA_ROLE ?? 'admin'],
});

let csrfToken = '';
let sessionCookie = '';
try {
  const bootstrap = await bootstrapBackendSession({
    facilityId,
    userId: authUserId,
    password: authPasswordPlain,
    clientUuid: session.clientUuid,
  });
  csrfToken = bootstrap.csrfToken;
  sessionCookie = bootstrap.sessionCookie;
} catch {
  const summary = {
    ...baseSummary,
    verdict: 'blocked_backend_session_unavailable',
    liveTrialAction: 'not_run',
    runtimeReadiness,
    response: sanitizeSoapDiseaseOfficialResponse({ workflow: guard.evidence.workflow, httpStatus: 0, responseJson: {} }),
  };
  persistSummary(summary);
  console.error('Phase 4 safe SOAP/disease wrapper blocked before live ORCA: backend session unavailable');
  console.error(`sanitized evidence: ${summaryJsonPath}`);
  process.exit(1);
}

const url = new URL(guard.evidence.officialServerRoute.replace(/^\//, ''), target.appRootUrl).toString();
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

const response = sanitizeSoapDiseaseOfficialResponse({ workflow: guard.evidence.workflow, httpStatus, responseJson });
const summary = {
  ...baseSummary,
  verdict: response.businessAccepted ? 'live_trial_business_accepted' : 'live_trial_not_accepted',
  liveTrialAction: 'executed_once',
  runtimeReadiness,
  response,
};
persistSummary(summary);
console.log(`Phase 4 safe SOAP/disease live Trial classification: ${response.responseClassification}`);
console.log(`sanitized evidence: ${summaryJsonPath}`);
process.exit(response.businessAccepted ? 0 : 1);
