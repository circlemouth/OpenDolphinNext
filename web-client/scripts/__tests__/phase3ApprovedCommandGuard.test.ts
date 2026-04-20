import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  APPROVED_PHASE3_CANDIDATE_ID,
  APPROVED_PHASE3_INPUT_IDENTITY_SHA256,
  APPROVED_PHASE3_PREFLIGHT_PATH,
  APPROVED_PHASE3_PREFLIGHT_SHA256,
  validateApprovedPhase3Command,
} from '../qa-lib/phase3-approved-command-guard.mjs';

const repoRoot = path.dirname(process.cwd());

const approvedArgs = (extra: string[] = []) => [
  '--candidate',
  APPROVED_PHASE3_CANDIDATE_ID,
  '--preflight',
  APPROVED_PHASE3_PREFLIGHT_PATH,
  '--preflight-sha256',
  APPROVED_PHASE3_PREFLIGHT_SHA256,
  '--input-identity-sha256',
  APPROVED_PHASE3_INPUT_IDENTITY_SHA256,
  '--sanitized-evidence-only',
  '--disable-browser-artifacts',
  '--phase3-only',
  ...extra,
];

describe('approved Phase 3 acceptmodv2 command guard', () => {
  it('accepts the exact candidate 00001 preflight in dry-run without authorizing Phase 4 or fullflow', () => {
    const result = validateApprovedPhase3Command({
      argv: approvedArgs(['--dry-run']),
      cwd: repoRoot,
      env: {},
      now: new Date('2026-04-20T22:05:28Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.mutation).toBe('not_run');
    expect(result.evidence.phase4).toBe('not_run');
    expect(result.evidence.fullflow).toBe('not_run');
    expect(result.evidence.candidate).toBe('00001');
    expect(result.evidence.allowedMutationAttemptCount).toBe(0);
    expect(result.evidence.browserNetworkArtifactMode).toBe('disabled');
  });

  it('rejects any candidate other than 00001 before mutation', () => {
    const result = validateApprovedPhase3Command({
      argv: approvedArgs(['--dry-run']).map((arg) => (arg === APPROVED_PHASE3_CANDIDATE_ID ? '00002' : arg)),
      cwd: repoRoot,
      env: {},
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('candidate must be 00001');
    expect(result.evidence.mutation).toBe('not_run');
  });

  it('rejects raw/browser/network artifact modes and Phase 4/fullflow flags before mutation', () => {
    const result = validateApprovedPhase3Command({
      argv: approvedArgs(['--dry-run', '--fullflow']),
      cwd: repoRoot,
      env: {
        QA_RECORD_HAR: '1',
        QA_RAW_NETWORK: '1',
        QA_PHASE4: '1',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockers.join('\n')).toContain('forbidden flag: --fullflow');
    expect(result.blockers.join('\n')).toContain('HAR recording is forbidden');
    expect(result.blockers.join('\n')).toContain('raw network capture is forbidden');
    expect(result.blockers.join('\n')).toContain('Phase 4 is forbidden');
    expect(result.evidence.mutation).toBe('not_run');
  });

  it('rejects preflight hash and input identity hash mismatches before mutation', () => {
    const result = validateApprovedPhase3Command({
      argv: [
        '--candidate',
        '00001',
        '--preflight',
        APPROVED_PHASE3_PREFLIGHT_PATH,
        '--preflight-sha256',
        'wrong',
        '--input-identity-sha256',
        'wrong',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--phase3-only',
        '--dry-run',
      ],
      cwd: repoRoot,
      env: {},
    });

    expect(result.ok).toBe(false);
    expect(result.blockers.join('\n')).toContain('preflight sha256 must match');
    expect(result.blockers.join('\n')).toContain('input identity sha256 must match');
    expect(result.evidence.mutation).toBe('not_run');
  });

  it('dry-run CLI writes sanitized evidence only and does not create browser or network artifact directories', () => {
    const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase3-approved-command-'));
    const child = spawnSync(process.execPath, [
      'web-client/scripts/qa-phase3-approved-acceptmodv2.mjs',
      ...approvedArgs(['--dry-run', '--artifact-dir', artifactDir]),
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(child.status).toBe(0);
    const evidencePath = path.join(artifactDir, 'phase3-approved-command.sanitized.json');
    expect(fs.existsSync(evidencePath)).toBe(true);
    expect(fs.existsSync(path.join(artifactDir, 'network'))).toBe(false);
    expect(fs.existsSync(path.join(artifactDir, 'screenshots'))).toBe(false);
    expect(fs.existsSync(path.join(artifactDir, 'har'))).toBe(false);
    const evidenceText = fs.readFileSync(evidencePath, 'utf8');
    expect(evidenceText).not.toContain('/api/orca/official/visits/mutation');
    expect(evidenceText).not.toContain('Cookie');
    expect(evidenceText).not.toContain('Authorization');
    expect(evidenceText).not.toContain('JSESSIONID');
    expect(evidenceText).not.toContain('.har');
    expect(evidenceText).not.toContain('screenshots/');
    expect(evidenceText).not.toContain('network/');
  });
});

