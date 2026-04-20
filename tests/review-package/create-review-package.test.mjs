import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { listEntries as listZipEntries, readEntry as readZipEntryBuffer } from '../../scripts/tools/zip-compat.mjs';

const SCRIPT_PATH = path.resolve('scripts/create-review-package.sh');
const COMMAND_LOG_WRAPPER_PATH = path.resolve('scripts/tools/command-log-wrapper.sh');
const METADATA_VALIDATOR_PATH = path.resolve('scripts/tools/validate-review-package-metadata.mjs');
const SCAN_REVIEW_BUNDLE_PATH = path.resolve('scripts/tools/scan-review-bundle.mjs');
const RUN_ID = '20260414T080812Z';

function toBashPath(filePath) {
  const resolved = path.resolve(filePath);
  if (process.platform !== 'win32') return resolved;
  return resolved.replace(/^([A-Za-z]):\\/, (_, drive) => `/mnt/${drive.toLowerCase()}/`).replaceAll('\\', '/');
}

const SCRIPT_PATH_BASH = toBashPath(SCRIPT_PATH);
const COMMAND_LOG_WRAPPER_PATH_BASH = toBashPath(COMMAND_LOG_WRAPPER_PATH);

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function removeTree(treePath) {
  try {
    fs.rmSync(treePath, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
  } catch {
    // Windows can briefly hold Git Bash working directories after process exit.
  }
}

function setupRepo(files) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'review-package-test-'));
  const repoDir = path.join(sandbox, 'repo');
  fs.mkdirSync(repoDir, { recursive: true });

  run('git', ['init', '-b', 'master'], repoDir);
  run('git', ['config', 'user.name', 'Codex Test'], repoDir);
  run('git', ['config', 'user.email', 'codex@example.invalid'], repoDir);

  for (const [relativePath, content] of Object.entries(files)) {
    writeText(path.join(repoDir, relativePath), content);
  }

  run('git', ['add', '.'], repoDir);
  run('git', ['commit', '-m', 'initial'], repoDir);

  return { sandbox, repoDir };
}

function listZip(zipPath, cwd) {
  return listZipEntries(zipPath).map((entry) => entry.name).filter(Boolean);
}

function readZipText(zipPath, entry) {
  return readZipEntryBuffer(zipPath, entry).toString('utf8');
}

function commandLogContent(command = 'npm test', commandOutput = 'test output', options = {}) {
  return [
    'command_log_version=1',
    `command=${command}`,
    'cwd=/repo',
    `runId=${RUN_ID}`,
    'start_utc=2026-04-14T08:08:12Z',
    ...(options.targetPath ? [`target_path=${options.targetPath}`, `target_sha256=${options.targetSha256 ?? '1'.repeat(64)}`] : []),
    '--- command output ---',
    commandOutput,
    '--- command summary ---',
    'end_utc=2026-04-14T08:08:13Z',
    'exit_code=0',
    'result=PASS',
    '',
  ].join('\n');
}

function parseKeyValue(text) {
  const values = new Map();
  for (const line of text.split('\n')) {
    const index = line.indexOf('=');
    if (index > 0) {
      values.set(line.slice(0, index), line.slice(index + 1));
    }
  }
  return values;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function replaceSummaryValue(summaryPath, key, value) {
  const lines = fs.readFileSync(summaryPath, 'utf8').split('\n');
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  assert.notEqual(index, -1, `summary key ${key} must exist`);
  lines[index] = `${key}=${value}`;
  fs.writeFileSync(summaryPath, lines.join('\n'), 'utf8');
}

function replaceLogValue(logPath, key, value) {
  const lines = fs.readFileSync(logPath, 'utf8').split('\n');
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  assert.notEqual(index, -1, `log key ${key} must exist`);
  lines[index] = `${key}=${value}`;
  fs.writeFileSync(logPath, lines.join('\n'), 'utf8');
}

test('creates a reviewer package without artifacts or legacy client content', () => {
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    'docs/guide.md': '# guide\n',
    'server-modernized/src/main/java/App.java': 'class App {}\n',
    'client/src/main/java/Legacy.java': 'class Legacy {}\n',
    'server/src/main/java/LegacyServer.java': 'class LegacyServer {}\n',
    'artifacts/evidence/run.txt': 'do not package\n',
    'web-client/dist/assets/app.js': 'compiled\n',
    'tmp/debug.txt': 'temporary\n',
  });

  try {
    const output = run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const entries = listZip(zipPath, repoDir);

    assert.match(output, /\[DONE\] RUN_ID=20260414T080812Z/);
    assert(entries.includes('README.md'));
    assert(entries.includes('docs/guide.md'));
    assert(entries.includes('server-modernized/src/main/java/App.java'));
    assert(entries.includes('REVIEW_PACKAGE_MANIFEST.txt'));
    assert(entries.includes('REVIEW_LOG_INCLUSIONS_MANIFEST.txt'));
    const manifest = readZipText(zipPath, 'REVIEW_PACKAGE_MANIFEST.txt');
    assert.match(manifest, /packageMode=extracted_review_subset/);
    assert.match(manifest, /root_dir=\./);
    assert.match(manifest, /git_metadata_included=no/);
    assert.match(manifest, /clean_checkout_claim=not_verified/);
    assert.match(manifest, /source_git_metadata_available=yes/);
    assert.match(manifest, /source_commit=[0-9a-f]{40}/);
    assert.match(manifest, /source_branch=master/);
    assert.match(manifest, /worktree_clean=not_verified/);
    assert.match(manifest, /git_claim_evidence_policy=git claims require package-included local git command logs/);
    assert.match(manifest, /guarantee_scope=extracted_review_subset_excludes_legacy_client_server_artifacts_generated_dirs_and_rejects_forbidden_dynamic_evidence_secrets/);
    assert.match(manifest, /non_guarantee_scope=not_clean_checkout_evidence_not_full_source_secret_scan_not_live_orca_evidence_not_git_truth/);
    assert.match(manifest, /secret_scan_scope=no_dynamic_review_evidence/);
    assert.match(manifest, /dynamic_secret_scan_claim=not_applicable/);
    assert.match(manifest, /bundle_included_source_scope_secret_scan_claim=not_claimed/);
    assert.match(manifest, /full_source_secret_scan_claim=not_claimed/);
    assert.match(manifest, /package_source_secret_scan_claim=recorded_in_external_sidecar/);
    assert.match(manifest, /package_source_secret_scan_scope=final_review_zip_post_creation/);
    assert.match(manifest, /package_source_secret_scan_evidence=OpenDolphin_WebClient-review-package-20260414T080812Z\.zip\.secret-scan-review-bundle\.log/);
    assert.match(manifest, /review_log_inclusions_manifest_entry=REVIEW_LOG_INCLUSIONS_MANIFEST\.txt/);
    assert.match(manifest, /zip_file_count=recorded_in_external_sidecar/);
    assert.match(manifest, /zip_size_bytes=recorded_in_external_sidecar/);
    assert.match(manifest, /zip_sha256=recorded_in_external_sidecar/);
    assert.match(manifest, /orca_phase2_5_zero_candidate_verdict=PARTIAL_TEST_DATA_OR_HARNESS_READINESS_BLOCKER/);
    assert.match(manifest, /orca_phase2_5_zero_candidate_semantics=acceptedCandidateCount_0_means_00001_to_00011_lack_current_read_only_mutation_ready_evidence_across_harness_api_auth_parser_readiness_exact_preflight_criteria_not_official_initial_patient_absence/);
    assert.match(manifest, /tracked_missing_file_count=0/);
    assert.match(manifest, /tracked_missing_files=none/);
    assert.match(manifest, /package_integrity_summary_file=OpenDolphin_WebClient-review-package-20260414T080812Z\.zip\.summary\.txt/);
    assert(!entries.some((entry) => entry.startsWith('client/')));
    assert(!entries.some((entry) => entry.startsWith('server/')));
    assert(!entries.some((entry) => entry.startsWith('artifacts/')));
    assert(!entries.some((entry) => entry.startsWith('.git/')));
    assert(!entries.some((entry) => entry.includes('/dist/')));
    assert(!entries.some((entry) => entry.includes('/node_modules/')));
    assert(!entries.some((entry) => entry.includes('/target/')));
    assert(!entries.some((entry) => entry.includes('/coverage/')));
    assert(!entries.some((entry) => entry.includes('/test-results/')));
    assert(!entries.some((entry) => entry.startsWith('tmp/')));

    const summaryPath = `${zipPath}.summary.txt`;
    const summary = parseKeyValue(fs.readFileSync(summaryPath, 'utf8'));
    assert.equal(summary.get('review_package_name'), `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    assert.equal(summary.get('packageMode'), 'extracted_review_subset');
    assert.equal(summary.get('zip_size_bytes'), String(fs.statSync(zipPath).size));
    assert.equal(summary.get('zip_sha256'), sha256File(zipPath));
    assert.equal(summary.get('secret_scan_scope'), 'no_dynamic_review_evidence');
    assert.equal(summary.get('dynamic_secret_scan_claim'), 'not_applicable');
    assert.equal(summary.get('bundle_included_source_scope_secret_scan_claim'), 'not_claimed');
    assert.equal(summary.get('full_source_secret_scan_claim'), 'not_claimed');
    assert.equal(summary.get('package_source_secret_scan_claim'), 'passed');
    assert.equal(summary.get('package_source_secret_scan_scope'), 'final_review_zip_post_creation');
    assert.equal(summary.get('package_source_secret_scan_target_path'), `out/OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    assert.equal(summary.get('package_source_secret_scan_target_sha256'), sha256File(zipPath));
    assert.equal(summary.get('review_log_inclusions_manifest_entry'), 'REVIEW_LOG_INCLUSIONS_MANIFEST.txt');
    assert.equal(summary.get('worktree_clean'), 'not_verified');
    assert.equal(summary.get('source_branch'), 'master');
    assert.match(summary.get('source_commit'), /^[0-9a-f]{40}$/);
    assert.match(summary.get('git_claim_evidence_policy'), /git claims require package-included local git command logs/);
    assert.match(run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir), /metadata validation passed/);
  } finally {
    removeTree(sandbox);
  }
});

test('adds manifest-listed review logs when requested', () => {
  const manifestPath = 'docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: [
      'RUN_ID=20260418T224551Z',
      'Review logs:',
      '- FINAL_REPORT.md',
      '- test-logs/static.log',
      '- dynamic-logs/dynamic.log',
      '- dynamic-evidence/accept-summary.sanitized.json',
      '- dynamic-evidence/subagent-command-log.json',
      '',
    ].join('\n'),
    'docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/FINAL_REPORT.md': '# final report\n',
    'docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/test-logs/static.log': commandLogContent('npm run verify:web-guard'),
    'docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/dynamic-logs/dynamic.log': commandLogContent('node scripts/runtime-ready-smoke.mjs'),
  });

  try {
    writeText(
      path.join(repoDir, 'docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/dynamic-evidence/accept-summary.sanitized.json'),
      '{"rawSensitiveFieldsExcluded":true}\n',
    );
    writeText(
      path.join(repoDir, 'docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/dynamic-evidence/subagent-command-log.json'),
      JSON.stringify(
        [
          {
            command: 'node --check web-client/scripts/qa-weborca-readonly-preflight.mjs',
            cwd: '/repo',
            runId: RUN_ID,
            start: '2026-04-14T08:08:12Z',
            end: '2026-04-14T08:08:13Z',
            exit_code: 0,
            safe_result: 'Static syntax validation passed.',
          },
        ],
        null,
        2,
      ),
    );
    const output = run(
      'bash',
      [
        SCRIPT_PATH_BASH,
        '--run-id',
        RUN_ID,
        '--out-dir',
        'out',
        '--name-suffix',
        '-with-dynamic-evidence',
        '--include-review-log-manifest',
        manifestPath,
      ],
      repoDir,
    );
    const zipPath = path.join(
      repoDir,
      'out',
      `OpenDolphin_WebClient-review-package-${RUN_ID}-with-dynamic-evidence.zip`,
    );
    const entries = listZip(zipPath, repoDir);
    const manifest = readZipText(zipPath, 'REVIEW_PACKAGE_MANIFEST.txt');

    assert.match(output, /with-dynamic-evidence\.zip/);
    assert(entries.includes(manifestPath));
    assert(entries.includes('docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/FINAL_REPORT.md'));
    assert(entries.includes('docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/test-logs/static.log'));
    assert(entries.includes('docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/dynamic-logs/dynamic.log'));
    assert(entries.includes('docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/dynamic-evidence/accept-summary.sanitized.json'));
    assert(entries.includes('docs/implementation/orca-trial-phase2_5-gate-hardening-20260419T131740Z/dynamic-evidence/subagent-command-log.json'));
    assert.match(manifest, /review_package_name=OpenDolphin_WebClient-review-package-20260414T080812Z-with-dynamic-evidence\.zip/);
    assert.match(manifest, /review_log_include_count=4/);
    assert.match(manifest, /review_log_schema=command_logs_require_command_cwd_runId_start_end_exit_code_and_non_empty_content/);
    assert.match(manifest, /secret_scan_scope=dynamic_review_evidence_only/);
    assert.match(manifest, /secret_scan_file_count=6/);
    assert.match(manifest, /secret_scan_claim=dynamic_review_evidence_passed/);
    assert.match(manifest, /dynamic_secret_scan_claim=passed/);
    assert.match(manifest, /package_source_secret_scan_claim=recorded_in_external_sidecar/);
    assert.match(manifest, /docs\/implementation\/orca-trial-phase2_5-gate-hardening-20260419T131740Z\/test-logs\/static\.log/);
    assert.match(run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir), /metadata validation passed/);
  } finally {
    removeTree(sandbox);
  }
});

test('claims package source-scope scan only when the package scan log proves pass', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const scanLogPath = 'docs/implementation/postfix/command-logs/secret-scan-review-bundle.log';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: ['RUN_ID=20260418T224551Z', '- command-logs/secret-scan-review-bundle.log', ''].join('\n'),
    [scanLogPath]: commandLogContent(
      'node scripts/tools/scan-review-bundle.mjs artifacts/review-bundles/package.zip',
      'review bundle included source scope secret scan passed: artifacts/review-bundles/package.zip',
      { targetPath: 'artifacts/review-bundles/package.zip' },
    ),
  });

  try {
    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const manifest = parseKeyValue(readZipText(zipPath, 'REVIEW_PACKAGE_MANIFEST.txt'));
    const summaryPath = `${zipPath}.summary.txt`;
    const summary = parseKeyValue(fs.readFileSync(summaryPath, 'utf8'));

    assert.equal(manifest.get('package_source_secret_scan_claim'), 'recorded_in_external_sidecar');
    assert.equal(manifest.get('bundle_included_source_scope_secret_scan_claim'), 'passed');
    assert.equal(summary.get('package_source_secret_scan_claim'), 'passed');
    assert.equal(summary.get('bundle_included_source_scope_secret_scan_claim'), 'passed');
    assert.match(run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir), /metadata validation passed/);

    replaceSummaryValue(summaryPath, 'package_source_secret_scan_claim', 'not_claimed');
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /package_source_secret_scan_claim/,
    );
  } finally {
    removeTree(sandbox);
  }
});

test('rejects dynamic-only evidence when the sidecar claims full source clean', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: ['RUN_ID=20260418T224551Z', '- dynamic-logs/dynamic.log', ''].join('\n'),
    'docs/implementation/postfix/dynamic-logs/dynamic.log': commandLogContent('node scripts/runtime-ready-smoke.mjs'),
  });

  try {
    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const summaryPath = `${zipPath}.summary.txt`;
    replaceSummaryValue(summaryPath, 'full_source_secret_scan_claim', 'passed');
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /full_source_secret_scan_claim/,
    );
  } finally {
    removeTree(sandbox);
  }
});

test('rejects final package scan evidence that targets a preliminary zip', () => {
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    'docs/guide.md': '# guide\n',
  });

  try {
    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const scanLogPath = `${zipPath}.secret-scan-review-bundle.log`;

    replaceLogValue(scanLogPath, 'target_path', 'out/preliminary-review-package.zip');
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /final review ZIP/,
    );

    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    replaceLogValue(scanLogPath, 'target_sha256', '0'.repeat(64));
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /target_sha256/,
    );
  } finally {
    removeTree(sandbox);
  }
});

test('rejects worktree clean claims without package-included git command log evidence', () => {
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    'docs/guide.md': '# guide\n',
  });

  try {
    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const summaryPath = `${zipPath}.summary.txt`;
    replaceSummaryValue(summaryPath, 'worktree_clean', 'yes');
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /worktree_clean/,
    );
  } finally {
    removeTree(sandbox);
  }
});

test('rejects package source-scope claim when secret-scan-review-bundle log is not a pass result', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: ['RUN_ID=20260418T224551Z', '- command-logs/secret-scan-review-bundle.log', ''].join('\n'),
    'docs/implementation/postfix/command-logs/secret-scan-review-bundle.log': commandLogContent(
      'node scripts/tools/scan-review-bundle.mjs artifacts/review-bundles/package.zip',
      'scan command ran but did not emit the source-scope pass marker',
      { targetPath: 'artifacts/review-bundles/package.zip' },
    ),
  });

  try {
    assert.throws(
      () => run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir),
      /does not prove package source-scope secret scan passed/,
    );
  } finally {
    removeTree(sandbox);
  }
});

test('rejects sidecar zip integrity drift', () => {
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    'docs/guide.md': '# guide\n',
  });

  try {
    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const summaryPath = `${zipPath}.summary.txt`;
    replaceSummaryValue(summaryPath, 'zip_file_count', '1');
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /zip_file_count/,
    );

    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    replaceSummaryValue(summaryPath, 'zip_size_bytes', '1');
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /zip_size_bytes/,
    );

    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    replaceSummaryValue(summaryPath, 'zip_sha256', '0'.repeat(64));
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /zip_sha256/,
    );
  } finally {
    removeTree(sandbox);
  }
});

test('packages extracted source subsets without git metadata as not verified git truth', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'review-package-extracted-subset-test-'));

  try {
    writeText(path.join(sandbox, 'README.md'), '# extracted subset\n');
    writeText(path.join(sandbox, 'docs/guide.md'), '# guide\n');
    writeText(path.join(sandbox, 'server-modernized/src/main/java/App.java'), 'class App {}\n');
    writeText(path.join(sandbox, 'client/legacy.txt'), 'legacy\n');
    writeText(path.join(sandbox, 'dist/app.js'), 'compiled\n');

    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], sandbox);
    const zipPath = path.join(sandbox, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const entries = listZip(zipPath, sandbox);
    const manifest = readZipText(zipPath, 'REVIEW_PACKAGE_MANIFEST.txt');

    assert(entries.includes('README.md'));
    assert(entries.includes('docs/guide.md'));
    assert(entries.includes('server-modernized/src/main/java/App.java'));
    assert(!entries.includes('client/legacy.txt'));
    assert(!entries.includes('dist/app.js'));
    assert.match(manifest, /packageMode=extracted_review_subset/);
    assert.match(manifest, /source_git_metadata_available=no/);
    assert.match(manifest, /source_commit=not_verified/);
    assert.match(manifest, /source_branch=not_verified/);
    assert.match(manifest, /worktree_clean=not_verified/);
    assert.match(manifest, /clean_checkout_claim=not_verified/);
  } finally {
    removeTree(sandbox);
  }
});

test('rejects raw artifact paths from review log manifests', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const rawCases = [
    ['dynamic-evidence/raw-upstream-response.xml', '<response />\n'],
    ['dynamic-evidence/screenshots/browser.png', 'not really a png\n'],
    ['dynamic-evidence/traces/browser.trace', 'not really a trace\n'],
    ['dynamic-evidence/videos/browser.webm', 'not really a video\n'],
    ['dynamic-evidence/network/raw-dump.json', '{"still":"raw path"}\n'],
  ];

  for (const [rawPath, content] of rawCases) {
    const { sandbox, repoDir } = setupRepo({
      'README.md': '# repo\n',
      [manifestPath]: ['RUN_ID=20260418T224551Z', `- ${rawPath}`, ''].join('\n'),
    });

    try {
      writeText(path.join(repoDir, 'docs/implementation/postfix', rawPath), content);
      assert.throws(
        () => run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir),
        /raw artifact and is not allowed/,
      );
    } finally {
      removeTree(sandbox);
    }
  }
});

test('scan tool rejects raw sensitive package path categories', () => {
  const forbiddenEntries = [
    'client/legacy.txt',
    'artifacts/evidence.txt',
    'node_modules/pkg/index.js',
    'web-client/dist/app.js',
    'server-modernized/target/app.jar',
    'coverage/lcov.info',
    'test-results/result.json',
    'docs/sample.har',
    'docs/traces/browser.trace',
    'docs/videos/session.webm',
    'docs/raw-screenshots/screen.txt',
    'docs/raw-network-dumps/dump.txt',
    '.git/HEAD',
  ];

  for (const entry of forbiddenEntries) {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'review-package-scan-forbidden-'));
    try {
      const filePath = path.join(sandbox, entry);
      writeText(filePath, 'sanitized fixture\n');
      const zipPath = path.join(sandbox, 'package.zip');
      run('node', [path.resolve('scripts/tools/zip-compat.mjs'), 'create', zipPath, entry], sandbox);
      assert.throws(
        () => run('node', [SCAN_REVIEW_BUNDLE_PATH, zipPath], sandbox),
        /forbidden raw\/generated path/,
        entry,
      );
    } finally {
      removeTree(sandbox);
    }
  }
});

test('rejects credential-bearing review evidence before packaging', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const secretCases = [
    ['authorization', 'Authorization: Bearer should-not-ship'],
    ['cookie', 'Cookie: JSESSIONID=should-not-ship'],
    ['jsessionid', 'JSESSIONID=should-not-ship'],
    ['csrf', 'X-CSRF-Token: should-not-ship'],
    ['raw-session', 'sessionId=should-not-ship'],
    ['raw-password', 'password=should-not-ship'],
    ['credential-url', `https://${'user' + ':pass@'}example.invalid/api`],
  ];

  for (const [caseName, secretLine] of secretCases) {
    const { sandbox, repoDir } = setupRepo({
      'README.md': '# repo\n',
      [manifestPath]: ['RUN_ID=20260418T224551Z', '- dynamic-logs/leaky.log', ''].join('\n'),
      'docs/implementation/postfix/dynamic-logs/leaky.log': [
        'command_log_version=1',
        'command=npm test',
        'cwd=/repo',
        `runId=${RUN_ID}`,
        'start_utc=2026-04-14T08:08:12Z',
        secretLine,
        'end_utc=2026-04-14T08:08:13Z',
        'exit_code=0',
        '',
      ].join('\n'),
    });

    try {
      assert.throws(
        () => run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', `out-${caseName}`, '--include-review-log-manifest', manifestPath], repoDir),
        /forbidden credential pattern/,
      );
    } finally {
      removeTree(sandbox);
    }
  }
});

test('rejects empty manifest-listed command logs', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: ['RUN_ID=20260418T224551Z', '- dynamic-logs/empty.log', ''].join('\n'),
    'docs/implementation/postfix/dynamic-logs/empty.log': '',
  });

  try {
    assert.throws(
      () => run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir),
      /empty and cannot be pass evidence/,
    );
  } finally {
    removeTree(sandbox);
  }
});

test('rejects malformed manifest-listed JSON command logs', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: ['RUN_ID=20260418T224551Z', '- dynamic-logs/subagent-command-log.json', ''].join('\n'),
  });

  try {
    writeText(
      path.join(repoDir, 'docs/implementation/postfix/dynamic-logs/subagent-command-log.json'),
      JSON.stringify([{ command: 'node --check script.mjs', cwd: '/repo', runId: RUN_ID }], null, 2),
    );
    assert.throws(
      () => run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir),
      /review JSON command log entry 0 missing start/,
    );
  } finally {
    removeTree(sandbox);
  }
});

test('records tracked missing file details in the package manifest', () => {
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    'docs/present.md': '# present\n',
    'docs/missing.md': '# missing\n',
  });

  try {
    fs.rmSync(path.join(repoDir, 'docs/missing.md'));
    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const entries = listZip(zipPath, repoDir);
    const manifest = readZipText(zipPath, 'REVIEW_PACKAGE_MANIFEST.txt');

    assert(entries.includes('docs/present.md'));
    assert(!entries.includes('docs/missing.md'));
    assert.match(manifest, /tracked_missing_file_count=1/);
    assert.match(manifest, /tracked_missing_files_begin/);
    assert.match(manifest, /path=docs\/missing\.md reason=tracked_by_git_but_absent_in_worktree source=git_ls_files category=source-test-docs criticality=critical/);
    assert.match(manifest, /tracked_missing_files_end/);
  } finally {
    removeTree(sandbox);
  }
});

test('command log wrapper writes exit code metadata for silent success', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'command-log-wrapper-test-'));
  const logPath = path.join(sandbox, 'silent-success.log');

  try {
    run(
      'bash',
      [COMMAND_LOG_WRAPPER_PATH_BASH, '--run-id', RUN_ID, '--log', toBashPath(logPath), '--cwd', toBashPath(sandbox), '--', 'bash', '-c', ':'],
      sandbox,
    );
    const log = fs.readFileSync(logPath, 'utf8');

    assert.notEqual(log.trim(), '');
    assert.match(log, /^command=bash -c :$/m);
    assert.match(log, new RegExp(`^runId=${RUN_ID}$`, 'm'));
    assert.match(log, /^start_utc=/m);
    assert.match(log, /^end_utc=/m);
    assert.match(log, /^exit_code=0$/m);
    assert.match(log, /^result=PASS$/m);
  } finally {
    removeTree(sandbox);
  }
});

test('command log wrapper records exact target metadata when supplied', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'command-log-wrapper-target-test-'));
  const logPath = path.join(sandbox, 'target-success.log');
  const targetPath = 'out/final-review.zip';
  const targetSha256 = '2'.repeat(64);

  try {
    run(
      'bash',
      [
        COMMAND_LOG_WRAPPER_PATH_BASH,
        '--run-id',
        RUN_ID,
        '--log',
        toBashPath(logPath),
        '--cwd',
        toBashPath(sandbox),
        '--target-path',
        targetPath,
        '--target-sha256',
        targetSha256,
        '--',
        'bash',
        '-c',
        ':',
      ],
      sandbox,
    );
    const log = fs.readFileSync(logPath, 'utf8');

    assert.match(log, new RegExp(`^target_path=${targetPath}$`, 'm'));
    assert.match(log, new RegExp(`^target_sha256=${targetSha256}$`, 'm'));
    assert.match(log, /^exit_code=0$/m);
  } finally {
    removeTree(sandbox);
  }
});

test('fails when every tracked file is excluded', () => {
  const { sandbox, repoDir } = setupRepo({
    'client/src/main/java/Legacy.java': 'class Legacy {}\n',
    'server/src/main/java/LegacyServer.java': 'class LegacyServer {}\n',
    'artifacts/evidence/run.txt': 'do not package\n',
    'tmp/debug.txt': 'temporary\n',
  });

  try {
    assert.throws(
      () => run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir),
      /No tracked files remained after exclusions/,
    );
  } finally {
    removeTree(sandbox);
  }
});
