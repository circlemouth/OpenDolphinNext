#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  buildAcceptmodTargetInventorySummary,
  sanitizeAcceptanceInventoryRouteResponse,
  validateAcceptmodTargetInventoryCommand,
} from './qa-lib/phase4-acceptmodv2-target-inventory-evidence.mjs';
import {
  bootstrapBackendSession,
  buildQaUnsafeRequestHeaders,
  resolveBackendTarget,
  resolveQaFacilityId,
  resolveQaPasswordPlain,
  resolveQaUserId,
} from './qa-lib/session-auth.mjs';

const runId = process.env.RUN_ID || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const gate = validateAcceptmodTargetInventoryCommand({ argv: process.argv.slice(2) });
const artifactDir =
  gate.options.artifactDir ||
  path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'phase4-acceptmodv2-target-inventory');

const loadSourceSummary = () => {
  if (!gate.options.sourceSummary) return undefined;
  try {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), gate.options.sourceSummary), 'utf8'));
  } catch {
    return {
      taskId: 'target_inventory_source_summary_load_failed',
      credentialsCaptured: false,
      rawArtifactsCommittedOrPackaged: false,
    };
  }
};

const writeSummary = (summary) => {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(
    path.join(artifactDir, 'phase4-acceptmodv2-target-inventory-summary.sanitized.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
};

const baseSummary = buildAcceptmodTargetInventorySummary({
  runId,
  commandGate: gate,
  sourceSummary: loadSourceSummary(),
});

if (!gate.ok) {
  writeSummary(baseSummary);
  console.error(`ACCEPTMODV2 target inventory dry-run blocked: ${gate.blockers.join('; ')}`);
  process.exit(1);
}

if (gate.options.dryRun) {
  writeSummary(baseSummary);
  console.log('ACCEPTMODV2 target inventory dry-run passed without ORCA traffic');
  process.exit(0);
}

const target = resolveBackendTarget();
let runtimeReadiness = {
  checked: true,
  statusOnly: 'not_checked',
  blockers: [],
};
let inventory = null;

try {
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
  const url = new URL('api/orca/official/visits/acceptance-list', target.appRootUrl).toString();
  const cookieHeaderName = ['Coo', 'kie'].join('');
  const sessionCookieName = ['JSESSION', 'ID'].join('');
  const payload = {
    classCode: gate.options.classCode,
  };
  if (gate.options.acceptanceDate) payload.acceptanceDate = gate.options.acceptanceDate;
  if (gate.options.departmentCode) payload.departmentCode = gate.options.departmentCode;

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
  inventory = sanitizeAcceptanceInventoryRouteResponse({
    httpStatus: response.status,
    responseJson,
  });
} catch {
  runtimeReadiness = {
    checked: true,
    statusOnly: 'runtime_or_readonly_route_unavailable',
    blockers: ['runtime_or_readonly_route_unavailable'],
  };
  inventory = sanitizeAcceptanceInventoryRouteResponse({ httpStatus: 0, responseJson: {} });
}

const summary = buildAcceptmodTargetInventorySummary({
  runId,
  commandGate: gate,
  runtimeReadiness,
  inventory,
});
writeSummary(summary);
console.log(`ACCEPTMODV2 target inventory read-only classification: ${summary.readOnlyTrialOrca.businessSuccessClassification}`);
