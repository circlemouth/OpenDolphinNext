#!/usr/bin/env node
import path from 'node:path';

import {
  buildBaseChargeFirstVisitSummary,
  executeReadonlyFirstVisitCheck,
  resolveTrialReadonlyConfig,
  validateBaseChargeFirstVisitCommand,
  writeBaseChargeFirstVisitSummary,
} from './qa-lib/phase4-base-charge-first-visit-evidence.mjs';
import { repoRootFromCwd } from './qa-lib/phase4-medicalmodv2-safe-evidence.mjs';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const traceId = process.env.TRACE_ID ?? `trace-${runId}`;
const repoRoot = repoRootFromCwd(process.cwd());
const guard = validateBaseChargeFirstVisitCommand({
  argv: process.argv.slice(2),
  env: process.env,
  cwd: process.cwd(),
});
const artifactDir = path.resolve(
  repoRoot,
  guard.options.artifactDir ??
    path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'phase4-base-charge-first-visit'),
);

const persistAndExit = (summary, exitCode) => {
  const { jsonPath } = writeBaseChargeFirstVisitSummary({ artifactDir, summary });
  console.log(`sanitized evidence: ${jsonPath}`);
  process.exit(exitCode);
};

if (!guard.ok) {
  persistAndExit(
    buildBaseChargeFirstVisitSummary({
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
    buildBaseChargeFirstVisitSummary({
      guard,
      runId,
      traceId,
      verdict: 'dry_run_passed_no_readonly_orca',
      blocker: '',
    }),
    0,
  );
}

const config = resolveTrialReadonlyConfig(process.env);
if (!config.ok) {
  persistAndExit(
    buildBaseChargeFirstVisitSummary({
      guard,
      runId,
      traceId,
      verdict: 'skipped_environment_unavailable_missing_runtime_secret_or_config',
      blocker: config.blockers.join('; '),
    }),
    2,
  );
}

let readonlyResult = null;
try {
  readonlyResult = await executeReadonlyFirstVisitCheck({
    config,
    patientId: guard.options.patientId,
    acceptanceDate: guard.options.acceptanceDate,
  });
} catch {
  persistAndExit(
    buildBaseChargeFirstVisitSummary({
      guard,
      runId,
      traceId,
      verdict: 'blocked_readonly_runtime_error_sanitized',
      blocker: 'readonly_orca_request_failed',
    }),
    1,
  );
}

const summary = buildBaseChargeFirstVisitSummary({ guard, runId, traceId, readonlyResult });
persistAndExit(summary, readonlyResult.firstVisitCompatible ? 0 : 1);
