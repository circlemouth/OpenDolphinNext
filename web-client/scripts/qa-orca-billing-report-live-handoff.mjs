#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  buildBillingReportLiveHandoffSummary,
  validateBillingReportLiveHandoffCommand,
} from './qa-lib/orca-billing-report-live-profile-evidence.mjs';

const runId = process.env.RUN_ID || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const commandGate = validateBillingReportLiveHandoffCommand({ argv: process.argv.slice(2), env: process.env });
const artifactDir =
  commandGate.options.artifactDir ||
  path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'billing-report-live-handoff');

const readDryRunSummary = () => {
  if (!commandGate.options.dryRunSummary) return null;
  try {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), commandGate.options.dryRunSummary), 'utf8'));
  } catch {
    return {
      source: 'dry_run_summary_load_failed',
      rawSensitiveFieldsExcluded: true,
      liveTrialOrca: { executed: false },
    };
  }
};

const summary = buildBillingReportLiveHandoffSummary({
  runId,
  commandGate,
  dryRunSummary: readDryRunSummary(),
});

fs.mkdirSync(artifactDir, { recursive: true });
const summaryPath = path.join(artifactDir, 'handoff.sanitized.json');
const markdownPath = path.join(artifactDir, 'handoff.sanitized.md');

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
fs.writeFileSync(
  markdownPath,
  `# ORCA Billing/Report Live Handoff\n\n` +
    `- RUN_ID: ${summary.runId}\n` +
    `- Contract: ${summary.commandContract}\n` +
    `- Manual approval required: yes\n` +
    `- Live ORCA traffic executed by this handoff: no\n` +
    `- Ready for manual live execution: ${summary.readyForManualLiveExecution ? 'yes' : 'no'}\n` +
    `- Raw sensitive fields excluded: yes\n`,
  'utf8',
);

if (!summary.readyForManualLiveExecution) {
  console.error(`ORCA billing/report live handoff blocked: ${summary.blockers.join('; ')}`);
  console.error(`sanitized evidence: ${summaryPath}`);
  process.exit(1);
}

console.log('ORCA billing/report live handoff ready; no live ORCA traffic executed');
console.log(`sanitized evidence: ${summaryPath}`);
