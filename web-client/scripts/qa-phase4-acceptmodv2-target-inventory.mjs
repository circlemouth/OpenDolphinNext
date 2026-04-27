#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  buildAcceptmodTargetInventoryDryRunSummary,
  validateAcceptmodTargetInventoryCommand,
} from './qa-lib/phase4-acceptmodv2-target-inventory-evidence.mjs';

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

const summary = buildAcceptmodTargetInventoryDryRunSummary({
  runId,
  commandGate: gate,
  sourceSummary: loadSourceSummary(),
});

fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(
  path.join(artifactDir, 'phase4-acceptmodv2-target-inventory-summary.sanitized.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
  'utf8',
);

if (!gate.ok) {
  console.error(`ACCEPTMODV2 target inventory dry-run blocked: ${gate.blockers.join('; ')}`);
  process.exit(1);
}

console.log('ACCEPTMODV2 target inventory dry-run passed without ORCA traffic');
