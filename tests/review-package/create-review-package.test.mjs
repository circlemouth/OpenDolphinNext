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
const ORCA_READONLY_FINALIZER_PATH = path.resolve('scripts/tools/orca-readonly-evidence-finalizer.mjs');
const ARTIFACT_LEDGER_VALIDATOR_PATH = path.resolve('scripts/tools/validate-artifact-ledger.mjs');
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
    `cwd=${options.cwd ?? '/repo'}`,
    `runId=${RUN_ID}`,
    'start_utc=2026-04-14T08:08:12Z',
    ...(options.targetPath ? [`target_path=${options.targetPath}`, `target_sha256=${options.targetSha256 ?? '1'.repeat(64)}`] : []),
    '--- command output ---',
    ...(commandOutput === null ? [] : [commandOutput]),
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
    'docs/implementation/old/OpenDolphin_WebClient-review-package-20260401T000000Z.zip': 'old package bytes\n',
    'docs/implementation/old/OpenDolphin_WebClient-review-package-20260401T000000Z.zip.summary.txt':
      'old package sidecar summary\n',
    'docs/implementation/old/raw-network-dumps/request.txt': 'raw network dump\n',
    'docs/implementation/old/raw-xml/response.xml': '<response>raw</response>\n',
    'docs/implementation/old/network/requests.json': 'raw network capture\n',
    'docs/implementation/old/trace/browser.trace': 'raw trace\n',
    'docs/implementation/old/videos/browser.webm': 'raw video\n',
    'docs/implementation/old/session.env': 'SESSION_SECRET=raw\n',
    'docs/sample.har': '{}\n',
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
    assert.match(manifest, /tracked_non_file_skipped_count=0/);
    assert.match(manifest, /tracked_non_file_skipped=none/);
    assert.match(manifest, /package_integrity_summary_file=OpenDolphin_WebClient-review-package-20260414T080812Z\.zip\.summary\.txt/);
    assert(!entries.some((entry) => entry.startsWith('client/')));
    assert(!entries.some((entry) => entry.startsWith('server/')));
    assert(!entries.some((entry) => entry.startsWith('artifacts/')));
    assert(!entries.some((entry) => entry.startsWith('.git/')));
    assert(!entries.some((entry) => entry.endsWith('.zip')));
    assert(!entries.some((entry) => /OpenDolphin_WebClient-review-package-.*\.zip\.summary\.txt$/.test(entry)));
    assert(!entries.some((entry) => entry.endsWith('.har')));
    assert(!entries.some((entry) => entry.endsWith('.env')));
    assert(!entries.some((entry) => entry.includes('/dist/')));
    assert(!entries.some((entry) => entry.includes('/node_modules/')));
    assert(!entries.some((entry) => entry.includes('/target/')));
    assert(!entries.some((entry) => entry.includes('/coverage/')));
    assert(!entries.some((entry) => entry.includes('/test-results/')));
    assert(!entries.some((entry) => entry.includes('/network/')));
    assert(!entries.some((entry) => entry.includes('/raw-network-dumps/')));
    assert(!entries.some((entry) => entry.includes('/raw-xml/')));
    assert(!entries.some((entry) => entry.includes('/trace/')));
    assert(!entries.some((entry) => entry.includes('/videos/')));
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
    assert.match(manifest, /review_log_include_count=5/);
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

test('rejects missing or stale artifact hash ledger', () => {
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    'docs/guide.md': '# guide\n',
  });

  try {
    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const ledgerPath = path.join(repoDir, 'out', 'artifact-sha256.txt');

    assert.match(fs.readFileSync(ledgerPath, 'utf8'), new RegExp(`  ${path.basename(zipPath)}$`, 'm'));
    assert.doesNotThrow(() => run('shasum', ['-a', '256', '-c', 'artifact-sha256.txt'], path.dirname(ledgerPath)));

    fs.rmSync(ledgerPath);
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /artifact hash ledger not found/,
    );

    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    writeText(ledgerPath, `${'0'.repeat(64)}  ${path.basename(zipPath)}\n`);
    assert.throws(
      () => run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir),
      /artifact hash ledger review package ZIP/,
    );
  } finally {
    removeTree(sandbox);
  }
});

test('validates complete evidence directory artifact ledgers', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-ledger-validator-test-'));

  try {
    const evidenceDir = path.join(sandbox, 'evidence');
    const summaryPath = path.join(evidenceDir, 'final-summary.sanitized.json');
    writeText(summaryPath, '{"ok":true}\n');
    assert.throws(
      () => run('node', [ARTIFACT_LEDGER_VALIDATOR_PATH, evidenceDir], sandbox),
      /artifact ledger not found/,
    );

    const ledgerPath = path.join(evidenceDir, 'artifact-sha256.txt');
    writeText(ledgerPath, `${sha256File(summaryPath)}  final-summary.sanitized.json\n`);
    assert.match(run('node', [ARTIFACT_LEDGER_VALIDATOR_PATH, evidenceDir], sandbox), /artifact ledger validation passed/);

    writeText(ledgerPath, `${'0'.repeat(64)}  final-summary.sanitized.json\n`);
    assert.throws(
      () => run('node', [ARTIFACT_LEDGER_VALIDATOR_PATH, evidenceDir], sandbox),
      /artifact ledger hash mismatch/,
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

test('finalizes sanitized ORCA readonly evidence summary and package sidecar fields', () => {
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    'docs/guide.md': '# guide\n',
  });
  const evidenceDir = path.join(
    repoDir,
    'docs/implementation/orca-trial-readonly-diagnostics-20260414T080812Z',
  );

  try {
    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', toBashPath(evidenceDir)], repoDir);
    const zipPath = path.join(evidenceDir, `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const summaryPath = `${zipPath}.summary.txt`;
    const packageSecretScanLogPath = `${zipPath}.secret-scan-review-bundle.log`;
    const metadataValidationLogPath = path.join(evidenceDir, 'final-package-metadata-validation.log');
    const statusJsonPath = path.join(evidenceDir, 'final-summary.status.sanitized.json');
    const candidateRowsJsonPath = path.join(evidenceDir, 'candidate-rows.sanitized.json');
    const commandLogJsonlPath = path.join(evidenceDir, 'command-log.jsonl');
    const reviewLogManifestPath = path.join(evidenceDir, 'REVIEW_LOG_INCLUSIONS_MANIFEST.txt');
    const packageSummary = parseKeyValue(fs.readFileSync(summaryPath, 'utf8'));
    const sourceCommit = packageSummary.get('source_commit');

    writeText(
      metadataValidationLogPath,
      commandLogContent(
        `node scripts/tools/validate-review-package-metadata.mjs ${path.relative(repoDir, zipPath)}`,
        `review package metadata validation passed: ${path.relative(repoDir, zipPath)}`,
        { cwd: repoDir, targetPath: path.relative(repoDir, zipPath), targetSha256: sha256File(zipPath) },
      ),
    );
    writeText(
      statusJsonPath,
      JSON.stringify(
        {
          sourceCommit,
          sourceCommitMatch: true,
          phase3ExecutionRunId: '20260414T080812Z-phase3-execution',
          preflightIdentityRunId: '20260414T080812Z-preflight-identity',
          childHarnessEvidenceRunId: '20260414T080812Z-child-harness',
          acceptedCandidateCount: '1/11',
          exactSelectedCandidatePreflightStatus: 'passed',
          phase3Status: 'not_run_pending_explicit_authorization',
          phase4Status: 'not_run',
          fullflowStatus: 'not_run',
          mutationStatus: 'not_run',
          c7Status: 'not_verified_no_target_mutation_request_capture',
          targetMutationRequestCount: 0,
          checkedRequests: 0,
          blockerDimensions: ['phase3_authorization_pending'],
          officialPatientgetStatus: 'http_200_apiResult_00_exact_match',
          officialPatientget500SourceClassified: 'classified_server_diagnostic_fix_verified',
          insuranceStatus: 'accepted',
          insuranceClassification: 'business_ready',
          insurance403SourceClassified: 'classified_auth_or_wrapper_ambiguity',
          appointmentStatus: 'not_required_direct_acceptance',
          appointmentClassification: 'direct_acceptance',
          appointment403SourceClassified: 'classified_auth_or_wrapper_ambiguity',
          selectorReadiness: 'ready',
          localSelectableReadiness: 'ready',
          medicalInformationReadiness: 'ready',
          primaryRejectionReason: 'none',
          rejectionReasons: [],
          sanitizeResult: 'passed',
        },
        null,
        2,
      ),
    );
    writeText(
      candidateRowsJsonPath,
      JSON.stringify(
        [
          {
            patientId: '00001',
            acceptedForPhase3Attempt: true,
            rawSensitiveFieldsExcluded: true,
          },
        ],
        null,
        2,
      ),
    );
    writeText(reviewLogManifestPath, ['RUN_ID=20260414T080812Z', 'Review logs:', '- final-summary.sanitized.json', ''].join('\n'));

    const finalizerArgs = [
      ORCA_READONLY_FINALIZER_PATH,
      '--run-id',
      RUN_ID,
      '--evidence-dir',
      evidenceDir,
      '--status-json',
      statusJsonPath,
      '--package-zip',
      zipPath,
      '--package-summary',
      summaryPath,
      '--package-secret-scan-log',
      packageSecretScanLogPath,
      '--metadata-validation-log',
      metadataValidationLogPath,
      '--candidate-rows-json',
      candidateRowsJsonPath,
      '--command-log-jsonl',
      commandLogJsonlPath,
      '--review-log-manifest',
      reviewLogManifestPath,
    ];

    writeText(
      commandLogJsonlPath,
      `${JSON.stringify({
        runId: RUN_ID,
        command: 'node scripts/qa-weborca-candidate-discovery.mjs',
        start_utc: '2026-04-14T08:08:12Z',
        end_utc: '2026-04-14T08:08:13Z',
        exit_code: 0,
        result: 'sanitized read-only discovery fixture',
      })}\n`,
    );
    assert.throws(
      () => run('node', finalizerArgs, repoDir),
      /command log JSONL line 1 missing cwd/,
    );

    writeText(
      commandLogJsonlPath,
      `${JSON.stringify({
        runId: RUN_ID,
        cwd: repoDir,
        command: 'node scripts/qa-weborca-candidate-discovery.mjs',
        start_utc: '2026-04-14T08:08:12Z',
        end_utc: '2026-04-14T08:08:13Z',
        exit_code: 0,
        result: 'sanitized read-only discovery fixture',
      })}\n`,
    );

    const output = run('node', finalizerArgs, repoDir);

    assert.match(output, /final sanitized summary written/);
    const summary = parseKeyValue(fs.readFileSync(summaryPath, 'utf8'));
    assert.equal(summary.get('source_commit_match'), 'true');
    assert.equal(summary.get('acceptedCandidateCount'), '1/11');
    assert.equal(summary.get('exact_selected_candidate_preflight_status'), 'passed');
    assert.equal(summary.get('phase3_status'), 'not_run_pending_explicit_authorization');
    assert.equal(summary.get('phase4_status'), 'not_run');
    assert.equal(summary.get('fullflow_status'), 'not_run');
    assert.equal(summary.get('mutation_status'), 'not_run');
    assert.equal(summary.get('c7_status'), 'not_verified_no_target_mutation_request_capture');
    assert.equal(summary.get('targetMutationRequestCount'), '0');
    assert.equal(summary.get('checkedRequests'), '0');
    assert.equal(summary.get('blocker_dimensions'), 'phase3_authorization_pending');
    assert.equal(summary.get('official_patientget_status'), 'http_200_apiResult_00_exact_match');
    assert.equal(summary.get('official_patientget_500_source_classified'), 'classified_server_diagnostic_fix_verified');
    assert.equal(summary.get('insurance_status'), 'accepted');
    assert.equal(summary.get('insurance_classification'), 'business_ready');
    assert.equal(summary.get('insurance_403_source_classified'), 'classified_auth_or_wrapper_ambiguity');
    assert.equal(summary.get('appointment_status'), 'not_required_direct_acceptance');
    assert.equal(summary.get('appointment_classification'), 'direct_acceptance');
    assert.equal(summary.get('appointment_403_source_classified'), 'classified_auth_or_wrapper_ambiguity');
    assert.equal(summary.get('selector_readiness'), 'ready');
    assert.equal(summary.get('local_selectable_readiness'), 'ready');
    assert.equal(summary.get('medical_information_readiness'), 'ready');
    assert.equal(summary.get('primary_rejection_reason'), 'none');
    assert.equal(summary.get('rejectionReasons'), '');
    assert.equal(summary.get('sanitize_result'), 'passed');
    assert.equal(summary.get('package_source_secret_scan_claim'), 'passed');
    assert.equal(summary.get('full_source_secret_scan_claim'), 'not_claimed');

    const finalSummary = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'final-summary.sanitized.json'), 'utf8'));
    assert.equal(finalSummary.packageMode, 'extracted_review_subset');
    assert.equal(finalSummary.source_commit_match, true);
    assert.equal(finalSummary.zip.sha256, sha256File(zipPath));
    assert.equal(finalSummary.phase2_5.acceptedCandidateCount, '1/11');
    assert.equal(finalSummary.phase2_5.officialPatientgetStatus, 'http_200_apiResult_00_exact_match');
    assert.equal(finalSummary.phase2_5.insuranceStatus, 'accepted');
    assert.equal(finalSummary.phase2_5.appointmentClassification, 'direct_acceptance');
    assert.equal(finalSummary.phase2_5.selectorReadiness, 'ready');
    assert.equal(finalSummary.phase2_5.sanitizeResult, 'passed');
    assert.equal(finalSummary.artifacts.candidateRowsSanitizedJson, 'candidate-rows.sanitized.json');
    assert.equal(finalSummary.artifacts.commandLogJsonl, 'command-log.jsonl');
    assert.equal(finalSummary.rawSensitiveFieldsExcluded, true);

    const secretScan = fs.readFileSync(path.join(evidenceDir, 'secret-scan.sanitized.txt'), 'utf8');
    assert.match(secretScan, /^claim=passed$/m);
    assert.match(secretScan, /^final_review_zip_sha256=[0-9a-f]{64}$/m);

    const hashes = fs.readFileSync(path.join(evidenceDir, 'artifact-sha256.txt'), 'utf8');
    assert.match(hashes, new RegExp(`  ${path.basename(zipPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
    assert.match(hashes, /  REVIEW_PACKAGE_MANIFEST\.txt$/m);
    assert.match(hashes, /  candidate-rows\.sanitized\.json$/m);
    assert.match(hashes, /  command-log\.jsonl$/m);
    assert.match(hashes, /  final-summary\.sanitized\.json$/m);
    assert.match(hashes, /  secret-scan\.sanitized\.txt$/m);
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
        /raw artifact and is not allowed|excluded from review packages/,
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
    'docs/network/requests.json',
    'docs/requests/capture.json',
    'docs/request-xml/patientget.xml',
    'docs/response-xml/patientget.xml',
    'docs/implementation/old/OpenDolphin_WebClient-review-package-20260401T000000Z.zip',
    'docs/archive/nested.zip',
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
        '--- command output ---',
        secretLine,
        '--- command summary ---',
        'end_utc=2026-04-14T08:08:13Z',
        'exit_code=0',
        'result=PASS',
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

test('rejects manifest-listed command logs with an empty output section', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: ['RUN_ID=20260418T224551Z', '- dynamic-logs/empty-output.log', ''].join('\n'),
    'docs/implementation/postfix/dynamic-logs/empty-output.log': commandLogContent('node --check script.mjs', null),
  });

  try {
    assert.throws(
      () => run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir),
      /empty command output evidence/,
    );
  } finally {
    removeTree(sandbox);
  }
});

test('rejects package command logs with placeholder-only timestamps', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: ['RUN_ID=20260418T224551Z', '- dynamic-logs/placeholder.log', ''].join('\n'),
    'docs/implementation/postfix/dynamic-logs/placeholder.log': [
      'command_log_version=1',
      'command=npm test',
      'cwd=/repo',
      `runId=${RUN_ID}`,
      'start=recorded_in_session_transcript',
      '--- command output ---',
      'test output',
      '--- command summary ---',
      'end=recorded_in_session_transcript',
      'exit_code=0',
      'result=PASS',
      '',
    ].join('\n'),
  });

  try {
    assert.throws(
      () => run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir),
      /placeholder-only start timestamp/,
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

test('rejects JSON command logs without non-empty output evidence', () => {
  const manifestPath = 'docs/implementation/postfix/REVIEW_LOG_INCLUSIONS_MANIFEST.txt';
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
    [manifestPath]: ['RUN_ID=20260418T224551Z', '- dynamic-logs/subagent-command-log.json', ''].join('\n'),
  });

  try {
    writeText(
      path.join(repoDir, 'docs/implementation/postfix/dynamic-logs/subagent-command-log.json'),
      JSON.stringify(
        [
          {
            command: 'node --check script.mjs',
            cwd: '/repo',
            runId: RUN_ID,
            start: '2026-04-14T08:08:12Z',
            end: '2026-04-14T08:08:13Z',
            exit_code: 0,
          },
        ],
        null,
        2,
      ),
    );
    assert.throws(
      () => run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out', '--include-review-log-manifest', manifestPath], repoDir),
      /missing non-empty output evidence/,
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

test('skips gitlink directory entries instead of packaging submodule contents', () => {
  const { sandbox, repoDir } = setupRepo({
    'README.md': '# repo\n',
  });

  try {
    run(
      'git',
      ['update-index', '--add', '--cacheinfo', '160000,808673e2cd0281963c30c49399cc81b0900b5dd0,deps/vendor'],
      repoDir,
    );
    run('git', ['commit', '-m', 'add gitlink'], repoDir);
    fs.mkdirSync(path.join(repoDir, 'deps/vendor'), { recursive: true });
    writeText(path.join(repoDir, 'deps/vendor/raw.txt'), 'submodule worktree content must not be packaged\n');

    run('bash', [SCRIPT_PATH_BASH, '--run-id', RUN_ID, '--out-dir', 'out'], repoDir);
    const zipPath = path.join(repoDir, 'out', `OpenDolphin_WebClient-review-package-${RUN_ID}.zip`);
    const entries = listZip(zipPath, repoDir);
    const manifest = readZipText(zipPath, 'REVIEW_PACKAGE_MANIFEST.txt');

    assert(!entries.includes('deps/vendor'));
    assert(!entries.includes('deps/vendor/raw.txt'));
    assert.match(manifest, /tracked_non_file_skipped_count=1/);
    assert.match(manifest, /path=deps\/vendor reason=tracked_by_git_but_not_a_regular_file_or_symlink source=git_ls_files category=gitlink_or_directory criticality=informational/);
    assert.match(run('node', [METADATA_VALIDATOR_PATH, zipPath], repoDir), /metadata validation passed/);
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
    assert.match(log, /^\[no stdout\/stderr emitted\]$/m);
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
