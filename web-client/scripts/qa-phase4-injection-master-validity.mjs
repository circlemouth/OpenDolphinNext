#!/usr/bin/env node
import path from 'node:path';

import {
  buildMasterValiditySummary,
  executeReadonlyMasterChecks,
  resolveTrialReadonlyConfig,
  validateMasterValidityCommand,
  writeMasterValiditySummary,
} from './qa-lib/phase4-master-validity-evidence.mjs';
import { repoRootFromCwd } from './qa-lib/phase4-medicalmodv2-safe-evidence.mjs';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const traceId = process.env.TRACE_ID ?? `trace-${runId}`;
const repoRoot = repoRootFromCwd(process.cwd());
const guard = validateMasterValidityCommand({
  argv: process.argv.slice(2),
  env: process.env,
  cwd: process.cwd(),
});
const artifactDir = path.resolve(
  repoRoot,
  guard.options.artifactDir ??
    path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'phase4-injection-master-validity'),
);

const persistAndExit = (summary, exitCode) => {
  const { jsonPath } = writeMasterValiditySummary({ artifactDir, summary });
  console.log(`sanitized evidence: ${jsonPath}`);
  process.exit(exitCode);
};

if (!guard.ok) {
  persistAndExit(
    buildMasterValiditySummary({
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
    buildMasterValiditySummary({
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
    buildMasterValiditySummary({
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
  readonlyChecks = await executeReadonlyMasterChecks({
    config,
    plan: guard.payloadEvidence.plan,
    baseDate: guard.options.baseDate,
  });
} catch {
  persistAndExit(
    buildMasterValiditySummary({
      guard,
      runId,
      traceId,
      verdict: 'blocked_readonly_runtime_error_sanitized',
      blocker: 'readonly_orca_request_failed',
    }),
    1,
  );
}

const summary = buildMasterValiditySummary({
  guard,
  runId,
  traceId,
  readonlyChecks,
  verdict: readonlyChecks.every((entry) => entry.masterFound)
    ? 'readonly_master_validity_validated'
    : 'readonly_master_validity_not_validated',
});
persistAndExit(summary, summary.masterValidity.allMasterVerified ? 0 : 1);
