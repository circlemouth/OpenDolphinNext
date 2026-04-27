#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  buildAcceptmodOperationDryRunSummary,
  validateAcceptmodOperationCommand,
} from './qa-lib/phase4-acceptmodv2-operation-evidence.mjs';

const runId = process.env.RUN_ID || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const gate = validateAcceptmodOperationCommand({ argv: process.argv.slice(2) });
const artifactDir =
  gate.options.artifactDir ||
  path.join('artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'phase4-acceptmodv2-operation');

const summary = buildAcceptmodOperationDryRunSummary({
  runId,
  requestNumber: gate.options.requestNumber,
  commandGate: gate,
});

fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(
  path.join(artifactDir, 'phase4-acceptmodv2-operation-summary.sanitized.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
  'utf8',
);

if (!gate.ok) {
  console.error(`RWO-07 acceptmodv2 operation dry-run blocked: ${gate.blockers.join('; ')}`);
  process.exit(1);
}

console.log('RWO-07 acceptmodv2 operation dry-run passed without live ORCA traffic');
