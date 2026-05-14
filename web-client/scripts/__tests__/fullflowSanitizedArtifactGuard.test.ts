import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const repoRoot = path.dirname(process.cwd());

describe('fullflow sanitized artifact guard', () => {
  it('uses the normal close-and-send workflow instead of the low-level ORCA send dialog', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'web-client/scripts/qa-fullflow-weborca.mjs'), 'utf8');

    expect(source).toContain('/api/local/encounters/');
    expect(source).toContain('/close-and-send-to-billing');
    expect(source).toContain("getByRole('alertdialog', { name: '診察終了して会計へ送信の確認' })");
    expect(source).toContain("getByRole('button', { name: '診察開始' })");
    expect(source).toContain('finish CTA visible after start');
    expect(source).toContain('const fullflowSensitiveKeys = ');
    expect(source).toContain('sanitizeFullflowEvidence(summary)');
    expect(source).not.toContain("getByRole('alertdialog', { name: 'ORCA送信の確認' })");
    expect(source).not.toContain('triggerSend');
    expect(source).not.toContain("fs.writeFileSync(summaryJsonPath, JSON.stringify(summary");
  });

  it('does not create raw browser/network artifact directories when sanitized mode fails before browser launch', () => {
    const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fullflow-sanitized-artifacts-'));
    const child = spawnSync(process.execPath, ['web-client/scripts/qa-fullflow-weborca.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        RUN_ID: '20260511T145138Z',
        QA_ARTIFACT_DIR: artifactDir,
        QA_SANITIZED_EVIDENCE_ONLY: '1',
        QA_DISABLE_BROWSER_ARTIFACTS: '1',
        QA_RECORD_HAR: '1',
      },
    });

    expect(child.status).not.toBe(0);
    expect(fs.existsSync(artifactDir)).toBe(true);
    expect(fs.existsSync(path.join(artifactDir, 'network'))).toBe(false);
    expect(fs.existsSync(path.join(artifactDir, 'screenshots'))).toBe(false);
    expect(fs.existsSync(path.join(artifactDir, 'har'))).toBe(false);
    expect(fs.existsSync(path.join(artifactDir, 'request-xml'))).toBe(false);
    expect(`${child.stdout}\n${child.stderr}`).not.toContain('network/network.json');
    expect(`${child.stdout}\n${child.stderr}`).not.toContain('screenshots/');
    expect(`${child.stdout}\n${child.stderr}`).not.toContain('request-xml/');
    expect(`${child.stdout}\n${child.stderr}`).not.toContain('.har');
  });

  it('keeps runtime-ready smoke evidence behind the same patient-context redaction helper', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'web-client/scripts/runtime-ready-smoke.mjs'), 'utf8');

    expect(source).toContain('const sanitizeForEvidence = ');
    expect(source).toContain('const writeSanitizedJson = ');
    expect(source).toContain("'patientId'");
    expect(source).toContain("'name'");
    expect(source).toContain("'text'");
    expect(source).toContain('runtime-ready-before-row-wait.json');
    expect(source).not.toContain("fs.writeFileSync(path.join(artifactRoot, 'runtime-ready-result.json'), JSON.stringify(result");
  });
});
