#!/usr/bin/env node
import path from 'node:path';

import {
  buildInstructionChargePreconditionSummary,
  executeInstructionChargeReadonlyPreconditionChecks,
  resolveInstructionChargeReadonlyConfig,
  validateInstructionChargePreconditionCommand,
  writeInstructionChargePreconditionSummary,
} from './qa-lib/phase4-instruction-charge-preconditions-evidence.mjs';
import { repoRootFromCwd } from './qa-lib/phase4-medicalmodv2-safe-evidence.mjs';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const traceId = process.env.TRACE_ID ?? `trace-${runId}`;
const repoRoot = repoRootFromCwd(process.cwd());
const guard = validateInstructionChargePreconditionCommand({
  argv: process.argv.slice(2),
  env: process.env,
  cwd: process.cwd(),
});
const artifactDir = path.resolve(
  repoRoot,
  guard.options.artifactDir ??
    path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'phase4-instruction-charge-preconditions'),
);

const persistAndExit = (summary, exitCode) => {
  const { jsonPath } = writeInstructionChargePreconditionSummary({ artifactDir, summary });
  console.log(`sanitized evidence: ${jsonPath}`);
  process.exit(exitCode);
};

if (!guard.ok) {
  persistAndExit(
    buildInstructionChargePreconditionSummary({
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
    buildInstructionChargePreconditionSummary({
      guard,
      runId,
      traceId,
      verdict: 'dry_run_passed_no_readonly_orca',
    }),
    0,
  );
}

const config = resolveInstructionChargeReadonlyConfig(process.env);
if (!config.ok) {
  persistAndExit(
    buildInstructionChargePreconditionSummary({
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
  readonlyChecks = await executeInstructionChargeReadonlyPreconditionChecks({
    config,
    context: {
      ...guard.payloadEvidence.context,
      candidateCode: guard.payloadEvidence.plan.candidateCodes[0],
    },
  });
} catch {
  persistAndExit(
    buildInstructionChargePreconditionSummary({
      guard,
      runId,
      traceId,
      verdict: 'blocked_readonly_runtime_error_sanitized',
      blocker: 'readonly_orca_request_failed',
    }),
    1,
  );
}

const summary = buildInstructionChargePreconditionSummary({
  guard,
  runId,
  traceId,
  readonlyChecks,
  verdict: readonlyChecks.length > 0
    ? 'readonly_preconditions_probe_completed'
    : 'readonly_preconditions_not_run',
});
persistAndExit(summary, summary.preconditions.allPreconditionsProven ? 0 : 1);
