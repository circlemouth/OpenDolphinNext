import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

import {
  BILLING_REPORT_LIVE_HANDOFF_CONTRACT,
  buildBillingReportLiveOperatorResultTemplate,
  buildBillingReportLiveResultSummary,
  validateBillingReportLiveResultCommand,
} from '../../web-client/scripts/qa-lib/orca-billing-report-live-profile-evidence.mjs';

const SCRIPT_PATH = path.resolve('web-client/scripts/qa-orca-billing-report-live-result.mjs');

function runNode(args) {
  return execFileSync(process.execPath, args, {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKeys(entry, keys));
    return keys;
  }
  if (!value || typeof value !== 'object') return keys;
  Object.entries(value).forEach(([key, nested]) => {
    keys.push(key);
    collectKeys(nested, keys);
  });
  return keys;
}

test('operator result template is sanitized and accepted by the result wrapper', () => {
  const template = buildBillingReportLiveOperatorResultTemplate();
  const commandGate = validateBillingReportLiveResultCommand({
    argv: [
      '--sanitized-evidence-only',
      '--disable-browser-artifacts',
      '--handoff-summary',
      'handoff.sanitized.json',
      '--operator-result-summary',
      'operator-result.sanitized.json',
    ],
    env: {},
  });
  const result = buildBillingReportLiveResultSummary({
    runId: '20260511T034219Z',
    commandGate,
    handoffSummary: {
      runId: '20260511T034219Z',
      commandContract: BILLING_REPORT_LIVE_HANDOFF_CONTRACT,
      readyForManualLiveExecution: true,
    },
    operatorResultSummary: template,
  });
  const templateKeys = new Set(collectKeys(template));

  assert.equal(result.liveTrialOrca.acceptedAsBillingReportEvidence, true);
  assert.deepEqual(result.blockers, []);
  assert.match(template.claimBoundary, /do not add raw patient/);
  [
    'rawDataId',
    'rawPatientId',
    'rawInvoiceNumber',
    'rawMedicalUid',
    'storageKey',
    'storageDigest',
    'authorization',
    'cookie',
    'csrf',
  ].forEach((key) => assert.equal(templateKeys.has(key), false));
});

test('result CLI prints the same sanitized operator template without writing artifacts', () => {
  const stdout = runNode([SCRIPT_PATH, '--print-operator-result-template']);
  const template = JSON.parse(stdout);

  assert.equal(template.source, 'orca-billing-report-live-operator-result');
  assert.equal(template.operatorOutcome, 'live_success_sanitized');
  assert.equal(template.rawSensitiveFieldsExcluded, true);
  assert.equal(template.reportSnapshots[0].serverGeneratedStorageKeyDigestPresent, true);
  assert.doesNotMatch(stdout, /must-not-leak|owner-approved-ticket|Bearer\s+|Basic\s+|patientName|invoiceNumber|Data_Id_Value/i);
});
