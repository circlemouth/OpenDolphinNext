#!/usr/bin/env node
import path from 'node:path';

import {
  buildSurgeryMasterProofSummary,
  executeReadonlySurgeryMasterProofChecks,
  resolveTrialReadonlyConfig,
  validateSurgeryMasterProofCommand,
  writeSurgeryMasterProofSummary,
} from './qa-lib/phase4-master-validity-evidence.mjs';
import { repoRootFromCwd } from './qa-lib/phase4-medicalmodv2-safe-evidence.mjs';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const traceId = process.env.TRACE_ID ?? `trace-${runId}`;
const repoRoot = repoRootFromCwd(process.cwd());
const guard = validateSurgeryMasterProofCommand({
  argv: process.argv.slice(2),
  env: process.env,
  cwd: process.cwd(),
});
const artifactDir = path.resolve(
  repoRoot,
  guard.options.artifactDir ??
    path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'phase4-surgery-master-proof'),
);

const persistAndExit = (summary, exitCode) => {
  const { jsonPath } = writeSurgeryMasterProofSummary({ artifactDir, summary });
  console.log(`sanitized evidence: ${jsonPath}`);
  process.exit(exitCode);
};

if (!guard.ok) {
  persistAndExit(
    buildSurgeryMasterProofSummary({
      guard,
      runId,
      traceId,
      verdict: 'rejected_before_readonly_orca',
      blocker: guard.blockers.join('; '),
    }),
    1,
  );
}

if (guard.options.dryRun) {
  persistAndExit(
    buildSurgeryMasterProofSummary({
      guard,
      runId,
      traceId,
      verdict: 'dry_run_passed_no_readonly_orca',
    }),
    0,
  );
}

const config = resolveTrialReadonlyConfig(process.env);
if (!config.ok) {
  persistAndExit(
    buildSurgeryMasterProofSummary({
      guard,
      runId,
      traceId,
      verdict: 'skipped_environment_unavailable_missing_runtime_secret_or_config',
      blocker: config.blockers.join('; '),
    }),
    2,
  );
}

let readonlyChecks = [];
try {
  readonlyChecks = await executeReadonlySurgeryMasterProofChecks({
    config,
    plan: guard.payloadEvidence.plan,
    baseDate: guard.options.baseDate,
  });
} catch {
  persistAndExit(
    buildSurgeryMasterProofSummary({
      guard,
      runId,
      traceId,
      verdict: 'blocked_readonly_runtime_error_sanitized',
      blocker: 'readonly_orca_request_failed',
    }),
    1,
  );
}

const allRowsProven = readonlyChecks.every((entry) => entry.masterFound);
persistAndExit(
  buildSurgeryMasterProofSummary({
    guard,
    runId,
    traceId,
    readonlyChecks,
    verdict: allRowsProven ? 'readonly_surgery_adjunct_rows_validated' : 'readonly_surgery_adjunct_rows_not_validated',
  }),
  allRowsProven ? 0 : 1,
);
