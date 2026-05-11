import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const repoRoot = path.dirname(process.cwd());

describe('fullflow sanitized artifact guard', () => {
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
});
