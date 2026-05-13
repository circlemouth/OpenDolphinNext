import { describe, expect, it } from 'vitest';

import { scanBundleContent } from '../verify-prod-bundle-secrets.mjs';

describe('production bundle secret scanner', () => {
  it('detects ORCA connection URLs and credential names in emitted assets', () => {
    const findings = scanBundleContent({
      file: 'assets/app.js',
      content: `
        const endpoint = "https://example-orca.invalid/api01rv2";
        const passwordKey = "ORCA_API_PASSWORD";
      `,
    });

    expect(findings.map((finding) => finding.pattern)).toEqual(
      expect.arrayContaining(['orca-url', 'orca-credential-env']),
    );
  });

  it('detects Basic auth and certificate material without printing raw matches', () => {
    const findings = scanBundleContent({
      file: 'assets/app.js',
      content: `
        const auth = "Basic dXNlcjpwYXNzd29yZA==";
        const cert = "-----BEGIN CERTIFICATE-----";
      `,
    });

    expect(findings.map((finding) => finding.pattern)).toEqual(
      expect.arrayContaining(['basic-auth-header', 'certificate-material']),
    );
    expect(findings.map((finding) => finding.sample).join('\n')).not.toContain('dXNlcjpwYXNzd29yZA==');
  });

  it('does not reject normal ORCA UI wording without transport material', () => {
    const findings = scanBundleContent({
      file: 'assets/app.js',
      content: 'const label = "ORCA送信結果が不明です";',
    });

    expect(findings).toEqual([]);
  });

  it('does not span Japanese UI copy from a generic ws scheme into later ORCA wording', () => {
    const findings = scanBundleContent({
      file: 'assets/app.js',
      content: 'const hint = "Push URL は ws:// または wss:// の絶対 URL で入力してください。ORCA 接続設定はサーバー側で保存します。";',
    });

    expect(findings).toEqual([]);
  });
});
