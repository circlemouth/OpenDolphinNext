#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  APPROVED_PHASE3_INPUT_IDENTITY_SHA256,
  APPROVED_PHASE3_PREFLIGHT_SHA256,
  validateApprovedPhase3Command,
} from './qa-lib/phase3-approved-command-guard.mjs';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const guard = validateApprovedPhase3Command({
  argv: process.argv.slice(2),
  env: process.env,
  cwd: process.cwd(),
  now,
});

const artifactDir = path.resolve(
  guard.repoRoot,
  guard.options.artifactDir ??
    path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'phase3-approved-command'),
);
fs.mkdirSync(artifactDir, { recursive: true });
const evidencePath = path.join(artifactDir, 'phase3-approved-command.sanitized.json');
fs.writeFileSync(evidencePath, JSON.stringify({
  ...guard.evidence,
  runId,
  evidencePath: path.relative(guard.repoRoot, evidencePath).split(path.sep).join('/'),
}, null, 2), 'utf8');

if (!guard.ok) {
  console.error(`approved Phase 3 command rejected before mutation: ${guard.blockers.join('; ')}`);
  console.error(`sanitized evidence: ${evidencePath}`);
  process.exit(1);
}

if (guard.options.dryRun || guard.options.mock) {
  console.log(`approved Phase 3 command ${guard.options.dryRun ? 'dry-run' : 'mock'} passed without ORCA or mutation route calls`);
  console.log(`sanitized evidence: ${evidencePath}`);
  process.exit(0);
}

const webClientRoot = path.join(guard.repoRoot, 'web-client');
const childEnv = {
  ...process.env,
  RUN_ID: guard.preflightSummary.inputIdentity.runId,
  QA_CANDIDATE_ID: '00001',
  QA_PATIENT_ID: '00001',
  QA_REQUIRE_READONLY_PREFLIGHT: '1',
  QA_READONLY_PREFLIGHT_SUMMARY: guard.preflightPath,
  QA_READONLY_PREFLIGHT_SHA256: APPROVED_PHASE3_PREFLIGHT_SHA256,
  QA_EXPECTED_INPUT_IDENTITY_SHA256: APPROVED_PHASE3_INPUT_IDENTITY_SHA256,
  QA_PHASE3_APPROVED_MODE: '1',
  QA_SANITIZED_EVIDENCE_ONLY: '1',
  QA_DISABLE_BROWSER_ARTIFACTS: '1',
  QA_RECORD_HAR: '0',
  QA_ALLOW_LOCAL_OPTION_INJECTION: '0',
  QA_ARTIFACT_DIR: path.join(artifactDir, 'acceptmodv2-sanitized'),
};

const child = spawnSync(process.execPath, ['scripts/qa-acceptmodv2-weborca.mjs'], {
  cwd: webClientRoot,
  env: childEnv,
  stdio: 'inherit',
});

process.exit(child.status ?? 1);

