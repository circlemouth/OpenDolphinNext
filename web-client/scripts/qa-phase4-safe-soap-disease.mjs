#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  SOAP_DISEASE_WRAPPER_CONTRACT,
  validateSoapDiseaseSafeCommand,
} from './qa-lib/phase4-soap-disease-safe-evidence.mjs';

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
  `- Business accepted: no\n` +
  `- Credentials captured: no\n` +
  `- Raw artifacts captured: no\n` +
  `- Raw payload/body stored: no\n`;

const persistSummary = (summary) => {
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(summaryMdPath, buildMarkdown(summary), 'utf8');
};

const summary = {
  ...guard.evidence,
  runId,
  traceId,
  commandContract: SOAP_DISEASE_WRAPPER_CONTRACT,
  evidencePath: path.relative(guard.repoRoot, summaryJsonPath).split(path.sep).join('/'),
  generatedArtifacts: [
    'phase4-soap-disease-summary.sanitized.json',
    'phase4-soap-disease-summary.sanitized.md',
  ],
  verdict: guard.ok ? (guard.options.dryRun ? 'dry_run_passed_no_live_orca' : 'mock_passed_no_live_orca') : 'rejected_before_live_orca',
};

persistSummary(summary);

if (!guard.ok) {
  console.error(`Phase 4 safe SOAP/disease wrapper rejected before live ORCA: ${guard.blockers.join('; ')}`);
  console.error(`sanitized evidence: ${summaryJsonPath}`);
  process.exit(1);
}

console.log(`Phase 4 safe SOAP/disease ${guard.options.dryRun ? 'dry-run' : 'mock'} passed without live ORCA traffic`);
console.log(`sanitized evidence: ${summaryJsonPath}`);
process.exit(0);
