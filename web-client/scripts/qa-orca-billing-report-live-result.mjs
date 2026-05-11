#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  buildBillingReportLiveOperatorResultTemplate,
  buildBillingReportLiveResultSummary,
  validateBillingReportLiveResultCommand,
} from './qa-lib/orca-billing-report-live-profile-evidence.mjs';

const runId = process.env.RUN_ID || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

if (process.argv.slice(2).includes('--print-operator-result-template')) {
  console.log(`${JSON.stringify(buildBillingReportLiveOperatorResultTemplate(), null, 2)}\n`);
  process.exit(0);
}

const commandGate = validateBillingReportLiveResultCommand({ argv: process.argv.slice(2), env: process.env });
const artifactDir =
  commandGate.options.artifactDir ||
  path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'billing-report-live-result');

const readJson = (filePath, fallbackSource) => {
  if (!filePath) return null;
  try {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8'));
  } catch {
    return {
      source: fallbackSource,
      rawSensitiveFieldsExcluded: true,
      liveTrialOrca: { executed: false },
    };
  }
};

const summary = buildBillingReportLiveResultSummary({
  runId,
  commandGate,
  handoffSummary: readJson(commandGate.options.handoffSummary, 'handoff_summary_load_failed'),
  operatorResultSummary: readJson(commandGate.options.operatorResultSummary, 'operator_result_summary_load_failed'),
});

fs.mkdirSync(artifactDir, { recursive: true });
const summaryPath = path.join(artifactDir, 'result.sanitized.json');
const markdownPath = path.join(artifactDir, 'result.sanitized.md');

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
fs.writeFileSync(
  markdownPath,
  `# ORCA Billing/Report Live Result\n\n` +
    `- RUN_ID: ${summary.runId}\n` +
    `- Contract: ${summary.commandContract}\n` +
    `- Outcome: ${summary.operatorOutcome || 'unknown'}\n` +
    `- Live ORCA traffic executed: ${summary.liveTrialOrca.executed ? 'yes' : 'no'}\n` +
    `- Accepted as billing/report evidence: ${summary.liveTrialOrca.acceptedAsBillingReportEvidence ? 'yes' : 'no'}\n` +
    `- Raw sensitive fields excluded: yes\n`,
  'utf8',
);

if (summary.blockers.length > 0) {
  console.error(`ORCA billing/report live result blocked: ${summary.blockers.join('; ')}`);
  console.error(`sanitized evidence: ${summaryPath}`);
  process.exit(1);
}

console.log(`ORCA billing/report live result recorded: ${summary.operatorOutcome}`);
console.log(`sanitized evidence: ${summaryPath}`);
