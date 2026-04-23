import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const SCRIPT_PATH = path.resolve('scripts/reviewer-submission-packet.mjs');
const RUN_ID = '20260414T010624Z';
const ACCEPTED_REF = 'codex/orca-closeout-recovery-20260414T010624Z';

function run(command, args, cwd, env = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function setupRepo() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewer-packet-test-'));
  const remoteDir = path.join(sandbox, 'origin.git');
  const repoDir = path.join(sandbox, 'repo');
  fs.mkdirSync(repoDir, { recursive: true });

  run('git', ['init', '--bare', remoteDir], sandbox);
  run('git', ['init', '-b', 'master'], repoDir);
  run('git', ['config', 'user.name', 'Codex Test'], repoDir);
  run('git', ['config', 'user.email', 'codex@example.invalid'], repoDir);

  writeText(path.join(repoDir, 'README.md'), '# test repo\n');
  writeText(path.join(repoDir, 'docs/runbooks/release-validation.md'), '# release validation\n');
  writeText(path.join(repoDir, 'docs/releases/orca-remediation-cutover.md'), '# cutover\n');
  writeText(path.join(repoDir, 'docs/runbooks/reviewer-submission-packet.md'), '# reviewer packet\n');

  run('git', ['add', '.'], repoDir);
  run('git', ['commit', '-m', 'initial'], repoDir);
  run('git', ['remote', 'add', 'origin', remoteDir], repoDir);
  run('git', ['push', '-u', 'origin', 'master'], repoDir);

  run('git', ['checkout', '-b', ACCEPTED_REF], repoDir);
  writeText(path.join(repoDir, 'src/app.txt'), 'accepted branch content\n');
  run('git', ['add', '.'], repoDir);
  run('git', ['commit', '-m', 'accepted'], repoDir);

  const acceptedHead = run('git', ['rev-parse', 'HEAD'], repoDir).trim();
  const mergeBase = run('git', ['merge-base', 'HEAD', 'origin/master'], repoDir).trim();

  return { sandbox, repoDir, remoteDir, acceptedHead, mergeBase };
}

function populateCloseout(repoDir, acceptedHead, mergeBase, options = {}) {
  const closeoutRoot = path.join(repoDir, 'artifacts/orca-remediation/closeout', RUN_ID);
  const packetRoot = closeoutRoot;
  const acceptedBranch = options.acceptedBranch ?? ACCEPTED_REF;
  const fullflowSummary = options.fullflowSummary ?? {
    runId: RUN_ID,
    blockerClassification: 'none',
    sendResult: {
      status: '200',
    },
    responseClassification: 'businessAccepted',
    rawSensitiveFieldsExcluded: true,
  };
  const sanitizedAcceptSummary = {
    schemaVersion: 1,
    runId: RUN_ID,
    candidateId: `${RUN_ID}:acceptmodv2`,
    command: 'node scripts/qa-acceptmodv2-weborca.mjs',
    cwd: 'web-client',
    responseClassification: 'businessAccepted',
    business: {
      businessAccepted: true,
      businessRejected: false,
      c7GateObserved: true,
    },
    c7: {
      checkedRequests: 1,
      violationCount: 0,
      violatedKeys: [],
      bodyKeysObserved: ['patientId'],
      medicalInformationFieldPresent: false,
      unspecifiedRun: true,
    },
    rawSensitiveFieldsExcluded: true,
  };

  const files = {
    'git/run-id.txt': `${RUN_ID}\n`,
    'git/accepted-branch.txt': `${acceptedBranch}\n`,
    'git/git-head-current.txt': `${options.headOverride ?? acceptedHead}\n`,
    'git/git-branch-current.txt': `${acceptedBranch}\n`,
    'git/git-status-short.txt': '\n',
    'git/git-merge-base-origin-master.txt': `${mergeBase}\n`,
    'git/git-diff-stat.txt': ' src/app.txt | 1 +\n 1 file changed, 1 insertion(+)\n',
    'git/git-log-oneline.txt': `${acceptedHead.slice(0, 7)} accepted\n`,
    'reports/final-report.md': options.finalReport ?? `# Final report\n\n- packet path: ${repoDir}/artifacts/orca-remediation/closeout/${RUN_ID}/qa/fullflow/summary.json\n`,
    'reports/command-log.md': '# command log\n',
    'reports/blocker-classification.md': options.blockerReport ?? '# blocker classification\n',
    'qa/acceptmodv2/accept-summary.sanitized.json': `${JSON.stringify(sanitizedAcceptSummary, null, 2)}\n`,
    'qa/acceptmodv2/steps.log': 'accept step\n',
    'qa/acceptmodv2/console.json': '[]\n',
    'qa/acceptmodv2/page-errors.json': '[]\n',
    'qa/fullflow/summary.json': `${JSON.stringify(fullflowSummary, null, 2)}\n`,
    'qa/fullflow/steps.log': 'fullflow step\n',
    'qa/fullflow/console.json': '[]\n',
    'qa/fullflow/page-errors.json': '[]\n',
    'evidence/patients-import/import-summary.json': '{"status":"ok"}\n',
    'evidence/medical-information-probe/probe-summary.json': '{"status":"ok"}\n',
    'evidence/medical-information-probe/route-response.json': '{"status":200}\n',
    'evidence/runtime-blockers/blocker-summary.json': '{"status":"ok"}\n',
    'evidence/runtime-blockers/selected-visit-row.json': '{"row":"ok"}\n',
    'evidence/runtime-blockers/handoff-state.json': '{"handoff":"ok"}\n',
  };

  for (const [relativePath, content] of Object.entries(files)) {
    if (options.omit?.includes(relativePath)) {
      continue;
    }
    writeText(path.join(packetRoot, relativePath), content);
  }

  return closeoutRoot;
}

function listPacket(packetDir) {
  return run('bash', ['-lc', 'find . -type f | LC_ALL=C sort'], packetDir)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((entry) => entry.replace(/^\.\//, ''));
}

test('fails when a required closeout file is missing', () => {
  const { sandbox, repoDir, acceptedHead, mergeBase } = setupRepo();
  try {
    populateCloseout(repoDir, acceptedHead, mergeBase, {
      omit: ['reports/final-report.md'],
    });
    assert.throws(
      () =>
        run(
          process.execPath,
          [SCRIPT_PATH, '--run-id', RUN_ID, '--accepted-ref', ACCEPTED_REF],
          repoDir,
          { REVIEWER_PACKET_REPO_ROOT: repoDir },
        ),
      /Missing required files:/,
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('fails when closeout HEAD does not match the accepted ref', () => {
  const { sandbox, repoDir, acceptedHead, mergeBase } = setupRepo();
  try {
    populateCloseout(repoDir, acceptedHead, mergeBase, {
      headOverride: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    });
    assert.throws(
      () =>
        run(
          process.execPath,
          [SCRIPT_PATH, '--run-id', RUN_ID, '--accepted-ref', ACCEPTED_REF],
          repoDir,
          { REVIEWER_PACKET_REPO_ROOT: repoDir },
        ),
      /closeout git-head-current mismatch/,
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('fails when an unrelated absolute path survives normalization', () => {
  const { sandbox, repoDir, acceptedHead, mergeBase } = setupRepo();
  try {
    populateCloseout(repoDir, acceptedHead, mergeBase, {
      blockerReport: '# blocker\n\n- leaked path: /Users/shared/private.log\n',
    });
    assert.throws(
      () =>
        run(
          process.execPath,
          [SCRIPT_PATH, '--run-id', RUN_ID, '--accepted-ref', ACCEPTED_REF],
          repoDir,
          { REVIEWER_PACKET_REPO_ROOT: repoDir },
        ),
      /Absolute local paths remain in packet text files/,
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('creates a clean review-checkout and validates the packet layout', () => {
  const { sandbox, repoDir, acceptedHead, mergeBase } = setupRepo();
  try {
    populateCloseout(repoDir, acceptedHead, mergeBase);
    const outputDir = path.join(repoDir, 'out');
    run(
      process.execPath,
      [SCRIPT_PATH, '--run-id', RUN_ID, '--accepted-ref', ACCEPTED_REF, '--output', 'out'],
      repoDir,
      { REVIEWER_PACKET_REPO_ROOT: repoDir },
    );
    run(
      process.execPath,
      [SCRIPT_PATH, '--validate-only', '--run-id', RUN_ID, '--accepted-ref', ACCEPTED_REF, '--output', 'out'],
      repoDir,
      { REVIEWER_PACKET_REPO_ROOT: repoDir },
    );

    const packetDir = path.join(outputDir, `submission-packet-${RUN_ID}`);
    const reviewCheckout = path.join(packetDir, 'review-checkout');
    const status = run('git', ['status', '--short'], reviewCheckout).trim();
    const originMaster = run('git', ['rev-parse', '--verify', 'origin/master^{commit}'], reviewCheckout).trim();
    const acceptSummary = JSON.parse(fs.readFileSync(path.join(packetDir, 'closeout-packet/qa/acceptmodv2/accept-summary.sanitized.json'), 'utf8'));
    const fileList = listPacket(packetDir);

    assert.equal(status, '');
    assert.equal(originMaster, mergeBase);
    assert.equal(acceptSummary.rawSensitiveFieldsExcluded, true);
    assert.deepEqual(
      fileList.filter((entry) =>
        [
          'README_REVIEW.md',
          'manifest.json',
          'manifest.sha256',
          'review-checkout/.git/HEAD',
          'closeout-packet/docs/packet-skill.md',
          'closeout-packet/evidence/patients-import/import-summary.json',
          'closeout-packet/qa/acceptmodv2/accept-summary.sanitized.json',
          'closeout-packet/reports/final-report.md',
        ].includes(entry),
      ),
      [
        'README_REVIEW.md',
        'closeout-packet/docs/packet-skill.md',
        'closeout-packet/evidence/patients-import/import-summary.json',
        'closeout-packet/qa/acceptmodv2/accept-summary.sanitized.json',
        'closeout-packet/reports/final-report.md',
        'manifest.json',
        'manifest.sha256',
        'review-checkout/.git/HEAD',
      ],
    );
    assert.ok(fs.existsSync(path.join(outputDir, `submission-packet-${RUN_ID}.zip`)));
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('fails when a sanitized summary still references request XML', () => {
  const { sandbox, repoDir, acceptedHead, mergeBase } = setupRepo();
  try {
    populateCloseout(repoDir, acceptedHead, mergeBase, {
      fullflowSummary: {
        runId: RUN_ID,
        blockerClassification: 'none',
        sendResult: {
          status: '200',
          requestXmlPath: 'request-xml/medicalmodv2.xml',
        },
        rawSensitiveFieldsExcluded: true,
      },
    });
    assert.throws(
      () =>
        run(
          process.execPath,
          [SCRIPT_PATH, '--run-id', RUN_ID, '--accepted-ref', ACCEPTED_REF],
          repoDir,
          { REVIEWER_PACKET_REPO_ROOT: repoDir },
        ),
      /qa\/fullflow\/summary\.json contains forbidden request_xml_reference/,
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('fails when copied reports still reference raw artifacts', () => {
  const { sandbox, repoDir, acceptedHead, mergeBase } = setupRepo();
  try {
    populateCloseout(repoDir, acceptedHead, mergeBase, {
      finalReport: '# Final report\n\n- raw response: raw-response.xml\n',
    });
    assert.throws(
      () =>
        run(
          process.execPath,
          [SCRIPT_PATH, '--run-id', RUN_ID, '--accepted-ref', ACCEPTED_REF],
          repoDir,
          { REVIEWER_PACKET_REPO_ROOT: repoDir },
        ),
      /Forbidden raw artifact references remain in packet evidence/,
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('freezes packet generation to --accepted-head even if the branch advances', () => {
  const { sandbox, repoDir, acceptedHead, mergeBase } = setupRepo();
  try {
    populateCloseout(repoDir, acceptedHead, mergeBase);
    writeText(path.join(repoDir, 'src/post-accepted.txt'), 'branch advanced\n');
    run('git', ['add', '.'], repoDir);
    run('git', ['commit', '-m', 'advance accepted ref'], repoDir);

    const outputDir = path.join(repoDir, 'out');
    run(
      process.execPath,
      [
        SCRIPT_PATH,
        '--run-id',
        RUN_ID,
        '--accepted-ref',
        ACCEPTED_REF,
        '--accepted-head',
        acceptedHead,
        '--output',
        'out',
      ],
      repoDir,
      { REVIEWER_PACKET_REPO_ROOT: repoDir },
    );
    run(
      process.execPath,
      [
        SCRIPT_PATH,
        '--validate-only',
        '--run-id',
        RUN_ID,
        '--accepted-ref',
        ACCEPTED_REF,
        '--accepted-head',
        acceptedHead,
        '--output',
        'out',
      ],
      repoDir,
      { REVIEWER_PACKET_REPO_ROOT: repoDir },
    );

    const packetDir = path.join(outputDir, `submission-packet-${RUN_ID}`);
    const reviewCheckout = path.join(packetDir, 'review-checkout');
    const manifest = JSON.parse(fs.readFileSync(path.join(packetDir, 'manifest.json'), 'utf8'));
    const checkoutHead = run('git', ['rev-parse', 'HEAD'], reviewCheckout).trim();

    assert.equal(manifest.acceptedHead, acceptedHead);
    assert.equal(checkoutHead, acceptedHead);
    assert.equal(fs.existsSync(path.join(reviewCheckout, 'src/post-accepted.txt')), false);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});
