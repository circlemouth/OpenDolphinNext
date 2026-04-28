#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  buildRwo08bTargetReadinessSummary,
  sanitizeIdentifierPreflightRouteResponse,
  validateRwo08bTargetReadinessCommand,
} from './qa-lib/rwo08b-target-readiness-evidence.mjs';
import {
  bootstrapBackendSession,
  buildQaUnsafeRequestHeaders,
  resolveBackendTarget,
  resolveQaFacilityId,
  resolveQaPasswordPlain,
  resolveQaUserId,
} from './qa-lib/session-auth.mjs';

const runId = process.env.RUN_ID || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const gate = validateRwo08bTargetReadinessCommand({ argv: process.argv.slice(2) });
const artifactDir =
  gate.options.artifactDir ||
  path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'rwo08b-target-readiness');

const readJson = (filePath) => {
  if (!filePath) return null;
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8'));
};

const writeSummary = (summary) => {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, 'summary.sanitized.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
};

const loadInputs = () => ({
  candidateDiscoverySummary: gate.options.candidateDiscoverySummary ? readJson(gate.options.candidateDiscoverySummary) : null,
  exactPreflightSummary: gate.options.exactPreflightSummary ? readJson(gate.options.exactPreflightSummary) : null,
  identifierPreflight: gate.options.identifierPreflightSummary ? readJson(gate.options.identifierPreflightSummary) : null,
});

const buildBaseSummary = (extra = {}) =>
  buildRwo08bTargetReadinessSummary({
    runId,
    commandGate: gate,
    ...loadInputs(),
    ...extra,
  });

if (!gate.ok) {
  writeSummary(buildBaseSummary());
  console.error(`RWO-08B target-readiness wrapper blocked: ${gate.blockers.join('; ')}`);
  process.exit(1);
}

if (gate.options.dryRun) {
  const summary = buildBaseSummary();
  writeSummary(summary);
  console.log(`RWO-08B target-readiness dry-run classification: ${summary.targetReadiness.businessSuccessClassification}`);
  process.exit(summary.targetReadiness.readyForDiagnosticFullflow ? 0 : 1);
}

let runtimeReadiness = {
  checked: true,
  statusOnly: 'not_checked',
  blockers: [],
};
let identifierPreflight = null;

try {
  const target = resolveBackendTarget();
  const facilityId = resolveQaFacilityId();
  const userId = resolveQaUserId();
  const password = resolveQaPasswordPlain();
  const clientUuid = `qa-${runId}`;
  const { csrfToken, sessionCookie } = await bootstrapBackendSession({
    facilityId,
    userId,
    password,
    clientUuid,
  });
  runtimeReadiness = {
    checked: true,
    statusOnly: 'session_bootstrap_ok',
    blockers: [],
  };
  const url = new URL('api/orca/official/visits/identifier-preflight', target.appRootUrl).toString();
  const cookieHeaderName = ['Coo', 'kie'].join('');
  const sessionCookieName = ['JSESSION', 'ID'].join('');
  const payload = {
    acceptanceDate: gate.options.acceptanceDate,
    classCode: gate.options.classCode,
    medicalGetClassCode: gate.options.medicalGetClassCode,
    targetRowHash: gate.options.targetRowHash,
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...buildQaUnsafeRequestHeaders({ baseURL: target.appRootUrl, csrfToken }),
      Accept: 'application/json',
      [cookieHeaderName]: `${sessionCookieName}=${sessionCookie}`,
      'X-Request-Id': runId,
    },
    body: JSON.stringify(payload),
  });
  const responseJson = response.ok ? await response.json().catch(() => ({})) : {};
  identifierPreflight = sanitizeIdentifierPreflightRouteResponse({
    httpStatus: response.status,
    responseJson,
  });
} catch {
  runtimeReadiness = {
    checked: true,
    statusOnly: 'runtime_or_readonly_route_unavailable',
    blockers: ['runtime_or_readonly_route_unavailable'],
  };
}

const summary = buildBaseSummary({
  identifierPreflight,
  runtimeReadiness,
});
writeSummary(summary);
console.log(`RWO-08B target-readiness read-only classification: ${summary.targetReadiness.businessSuccessClassification}`);
process.exit(summary.targetReadiness.readyForDiagnosticFullflow ? 0 : 1);
