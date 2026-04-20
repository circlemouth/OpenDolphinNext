import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildInputIdentity,
  validatePreflightSummary,
} from './acceptmodv2-identity-gate.mjs';

export const APPROVED_PHASE3_CANDIDATE_ID = '00001';
export const APPROVED_PHASE3_PREFLIGHT_PATH =
  'docs/implementation/orca-trial-readonly-contract-fix-20260420T141516Z/exact-selected-candidate-preflight.sanitized.json';
export const APPROVED_PHASE3_PREFLIGHT_SHA256 =
  '57d43788d7384cdcdc6368271bbcfdf1a2f1a87e92c6ee801271c36332159590';
export const APPROVED_PHASE3_INPUT_IDENTITY_SHA256 =
  '356d109381b57e0c792eada1a4bd394248c6fca8273a82ab770143efc92bc29a';
export const APPROVED_PHASE3_ALLOWED_REQUEST_NUMBER = '01';
export const APPROVED_PHASE3_FORBIDDEN_REQUEST_NUMBERS = ['00', '02', '03', '04'];

const FORBIDDEN_FLAGS = new Set([
  '--phase4',
  '--run-phase4',
  '--fullflow',
  '--run-fullflow',
  '--other-candidate',
  '--direct-curl',
  '--record-har',
  '--har',
  '--trace',
  '--video',
  '--screenshot',
  '--screenshots',
  '--raw-network',
  '--network-dump',
  '--browser-artifacts',
]);

const FORBIDDEN_ENV = [
  ['QA_RECORD_HAR', '1', 'HAR recording is forbidden'],
  ['QA_TRACE', '1', 'trace recording is forbidden'],
  ['QA_VIDEO', '1', 'video recording is forbidden'],
  ['QA_SCREENSHOT', '1', 'screenshot recording is forbidden'],
  ['QA_SCREENSHOTS', '1', 'screenshot recording is forbidden'],
  ['QA_RAW_NETWORK', '1', 'raw network capture is forbidden'],
  ['QA_CAPTURE_NETWORK_RAW', '1', 'raw network capture is forbidden'],
  ['QA_PHASE4', '1', 'Phase 4 is forbidden'],
  ['QA_FULLFLOW', '1', 'fullflow is forbidden'],
  ['QA_ALLOW_LOCAL_OPTION_INJECTION', '1', 'local option injection is forbidden'],
];

const VALUE_FLAGS = new Set([
  '--candidate',
  '--preflight',
  '--preflight-sha256',
  '--input-identity-sha256',
  '--artifact-dir',
]);

const BOOLEAN_FLAGS = new Set([
  '--dry-run',
  '--mock',
  '--execute-approved-mutation',
  '--sanitized-evidence-only',
  '--disable-browser-artifacts',
  '--phase3-only',
]);

export const repoRootFromCwd = (cwd = process.cwd()) =>
  path.basename(cwd) === 'web-client' ? path.dirname(cwd) : cwd;

const normalizeRepoRelativePath = (value, repoRoot) => {
  const resolved = path.resolve(repoRoot, value);
  return path.relative(repoRoot, resolved).split(path.sep).join('/');
};

export const parseApprovedPhase3Args = (argv) => {
  const options = {
    dryRun: false,
    mock: false,
    executeApprovedMutation: false,
    sanitizedEvidenceOnly: false,
    disableBrowserArtifacts: false,
    phase3Only: false,
  };
  const errors = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (FORBIDDEN_FLAGS.has(arg)) {
      errors.push(`forbidden flag: ${arg}`);
      continue;
    }
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        errors.push(`missing value for ${arg}`);
        continue;
      }
      index += 1;
      if (arg === '--candidate') options.candidate = value;
      if (arg === '--preflight') options.preflight = value;
      if (arg === '--preflight-sha256') options.preflightSha256 = value;
      if (arg === '--input-identity-sha256') options.inputIdentitySha256 = value;
      if (arg === '--artifact-dir') options.artifactDir = value;
      continue;
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      if (arg === '--dry-run') options.dryRun = true;
      if (arg === '--mock') options.mock = true;
      if (arg === '--execute-approved-mutation') options.executeApprovedMutation = true;
      if (arg === '--sanitized-evidence-only') options.sanitizedEvidenceOnly = true;
      if (arg === '--disable-browser-artifacts') options.disableBrowserArtifacts = true;
      if (arg === '--phase3-only') options.phase3Only = true;
      continue;
    }
    errors.push(`unknown flag: ${arg}`);
  }

  return { options, errors };
};

const sha256File = (filePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const isOldMutationArtifactPath = (repoRelativePath) =>
  /(^|\/)(acceptmodv2|fullflow|network|requests|screenshots?|har|trace|video)(\/|$)/i.test(repoRelativePath) ||
  /accept-summary|network\.json|requests\.json|\.har$|\.zip$/i.test(repoRelativePath);

const expectedFromPreflight = (summary) => ({
  runId: summary?.inputIdentity?.runId ?? summary?.runId ?? '',
  candidateId: summary?.candidateId ?? '',
  facilityId: summary?.facilityId ?? summary?.inputIdentity?.candidate?.facilityId ?? '',
  patientId: summary?.patientId ?? summary?.phase3AttemptPatientId ?? '',
  departmentCode: summary?.departmentCode ?? '',
  physicianCode: summary?.physicianCode ?? '',
  paymentMode: summary?.paymentMode ?? '',
  visitKind: summary?.visitKind ?? '',
  medicalInformation:
    summary?.medicalInformationState?.state === 'selected'
      ? summary?.medicalInformationState?.value ?? ''
      : '',
});

export const validateApprovedPhase3Command = ({
  argv = [],
  env = process.env,
  cwd = process.cwd(),
  now = new Date(),
} = {}) => {
  const repoRoot = repoRootFromCwd(cwd);
  const { options, errors } = parseApprovedPhase3Args(argv);
  const blockers = [...errors];
  const modeCount = [options.dryRun, options.mock, options.executeApprovedMutation].filter(Boolean).length;
  if (modeCount !== 1) {
    blockers.push('exactly one of --dry-run, --mock, or --execute-approved-mutation is required');
  }
  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (!options.phase3Only) blockers.push('--phase3-only is required');

  for (const [key, forbiddenValue, reason] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`${key}=${forbiddenValue}: ${reason}`);
  }

  if (options.candidate !== APPROVED_PHASE3_CANDIDATE_ID) {
    blockers.push(`candidate must be ${APPROVED_PHASE3_CANDIDATE_ID}`);
  }
  if (options.preflightSha256 !== APPROVED_PHASE3_PREFLIGHT_SHA256) {
    blockers.push('preflight sha256 must match the approved exact selected-candidate artifact hash');
  }
  if (options.inputIdentitySha256 !== APPROVED_PHASE3_INPUT_IDENTITY_SHA256) {
    blockers.push('input identity sha256 must match the approved Phase 3 handoff identity');
  }

  const repoRelativePreflight = options.preflight
    ? normalizeRepoRelativePath(options.preflight, repoRoot)
    : '';
  if (repoRelativePreflight !== APPROVED_PHASE3_PREFLIGHT_PATH) {
    blockers.push(`preflight path must be ${APPROVED_PHASE3_PREFLIGHT_PATH}`);
  }
  if (repoRelativePreflight && isOldMutationArtifactPath(repoRelativePreflight)) {
    blockers.push('old mutation-route/browser/network artifact path cannot authorize Phase 3');
  }

  const preflightPath = options.preflight ? path.resolve(repoRoot, options.preflight) : '';
  let summary = null;
  let actualPreflightSha256 = '';
  if (!preflightPath || !fs.existsSync(preflightPath)) {
    blockers.push('preflight file is missing');
  } else {
    try {
      actualPreflightSha256 = sha256File(preflightPath);
      if (actualPreflightSha256 !== APPROVED_PHASE3_PREFLIGHT_SHA256) {
        blockers.push('preflight file sha256 mismatch');
      }
      summary = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
    } catch (error) {
      blockers.push(`preflight file cannot be parsed: ${String(error)}`);
    }
  }

  let identityGate = null;
  if (summary) {
    if (summary.candidateId !== APPROVED_PHASE3_CANDIDATE_ID || summary.patientId !== APPROVED_PHASE3_CANDIDATE_ID) {
      blockers.push('preflight candidate/patient must both be 00001');
    }
    if (summary.acceptedForPhase3Attempt !== true) {
      blockers.push('acceptedForPhase3Attempt must be strict boolean true');
    }
    if (summary?.inputIdentity?.hash !== APPROVED_PHASE3_INPUT_IDENTITY_SHA256) {
      blockers.push('preflight inputIdentity.hash mismatch');
    }
    const targetMutationRequestCount = Number(summary?.mutationPolicy?.targetMutationRequestCount);
    if (targetMutationRequestCount !== 0) {
      blockers.push('preflight targetMutationRequestCount must be 0');
    }
    const expected = expectedFromPreflight(summary);
    identityGate = validatePreflightSummary({
      summary,
      artifactPath: repoRelativePreflight,
      artifactSha256: actualPreflightSha256,
      expectedArtifactSha256: APPROVED_PHASE3_PREFLIGHT_SHA256,
      expectedInputIdentitySha256: APPROVED_PHASE3_INPUT_IDENTITY_SHA256,
      expected,
    });
    if (!identityGate.ok) {
      blockers.push(`identity gate rejected preflight: ${identityGate.error}`);
    }
  }

  const ok = blockers.length === 0;
  const preflightIdentity = summary ? expectedFromPreflight(summary) : {};
  const evidence = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    commandContract: 'approved-phase3-acceptmodv2-sanitized-only',
    verdict: ok ? 'accepted' : 'rejected_before_mutation',
    mutation: 'not_run',
    phase3: options.executeApprovedMutation && ok ? 'approved_to_execute_by_command_contract' : 'not_run',
    phase4: 'not_run',
    fullflow: 'not_run',
    candidate: APPROVED_PHASE3_CANDIDATE_ID,
    selectedCandidateOnly: true,
    otherCandidatesMutation: 'not_run',
    allowedMutationAttemptCount: options.executeApprovedMutation && ok ? 1 : 0,
    forbiddenMutationRequestCount: 0,
    intendedMutationRequestNumber: APPROVED_PHASE3_ALLOWED_REQUEST_NUMBER,
    forbiddenRequestNumbers: APPROVED_PHASE3_FORBIDDEN_REQUEST_NUMBERS,
    browserNetworkArtifactMode: 'disabled',
    sanitizedEvidenceOnly: true,
    rawSensitiveFieldsExcluded: true,
    preflight: {
      path: repoRelativePreflight,
      expectedSha256: APPROVED_PHASE3_PREFLIGHT_SHA256,
      actualSha256: actualPreflightSha256,
      acceptedForPhase3Attempt: summary?.acceptedForPhase3Attempt === true,
      targetMutationRequestCount: summary?.mutationPolicy?.targetMutationRequestCount ?? null,
    },
    inputIdentity: {
      expectedSha256: APPROVED_PHASE3_INPUT_IDENTITY_SHA256,
      actualSha256: summary?.inputIdentity?.hash ?? '',
      computedSha256: summary ? buildInputIdentity(preflightIdentity).hash : '',
    },
    requestSemantics: {
      requestNumber01OnlyFutureMutation: true,
      requestNumber00IsInquiryOnly: true,
      requestNumber02To04ForbiddenForPhase3: true,
      apiResult60IsNotMutationSuccess: true,
      http200AloneIsNotBusinessSuccess: true,
      acceptedForPhase3AttemptIsNotMutationSuccess: true,
      diagnosticNotRunIsNotMutationSuccess: true,
    },
    guard: {
      ok,
      blockers,
      identityGate,
    },
  };

  return {
    ok,
    options,
    blockers,
    repoRoot,
    preflightPath,
    preflightRepoRelativePath: repoRelativePreflight,
    preflightSummary: summary,
    identityGate,
    evidence,
  };
};

