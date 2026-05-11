#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  buildBillingReportLiveProfileSummary,
  validateBillingReportLiveProfileCommand,
} from './qa-lib/orca-billing-report-live-profile-evidence.mjs';

const runId = process.env.RUN_ID || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const commandGate = validateBillingReportLiveProfileCommand({ argv: process.argv.slice(2) });
const artifactDir =
  commandGate.options.artifactDir ||
  path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'billing-report-live-profile');

const readJson = (filePath) => {
  if (!filePath) return null;
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8'));
};

const summary = buildBillingReportLiveProfileSummary({
  runId,
  commandGate,
  candidateDiscoverySummary: readJson(commandGate.options.candidateDiscoverySummary),
  exactPreflightSummary: readJson(commandGate.options.exactPreflightSummary),
});

fs.mkdirSync(artifactDir, { recursive: true });
const summaryPath = path.join(artifactDir, 'summary.sanitized.json');
const markdownPath = path.join(artifactDir, 'summary.sanitized.md');

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
fs.writeFileSync(
  markdownPath,
  `# ORCA Billing/Report Live Profile Dry Run\n\n` +
    `- RUN_ID: ${summary.runId}\n` +
    `- Contract: ${summary.commandContract}\n` +
    `- Dry run only: yes\n` +
    `- Live ORCA traffic: no\n` +
    `- Ready: ${summary.readyForBillingReportLiveProfile ? 'yes' : 'no'}\n` +
    `- Raw sensitive fields excluded: yes\n`,
  'utf8',
);

console.log(`ORCA billing/report live profile dry-run: ${summary.readyForBillingReportLiveProfile ? 'ready' : 'blocked'}`);
console.log(`sanitized evidence: ${summaryPath}`);
process.exit(summary.readyForBillingReportLiveProfile ? 0 : 1);
