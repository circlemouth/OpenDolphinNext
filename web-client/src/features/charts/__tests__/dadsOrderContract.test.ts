import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const extractSaveFooter = (source: string) => {
  const start = source.search(/<footer\s+className="[^"]*charts-side-panel__dock-footer[^"]*"\s+aria-label="保存操作">/);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('</footer>', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

const countMatches = (source: string, pattern: RegExp) => source.match(pattern)?.length ?? 0;

describe('DADS order editor action hierarchy contract', () => {
  it('keeps one visually strongest save action in the general order editor footer', () => {
    const footer = extractSaveFooter(readSource('../OrderBundleEditPanel.tsx'));

    expect(countMatches(footer, /charts-side-panel__action--save/g)).toBe(1);
    expect(countMatches(footer, /charts-side-panel__action--expand(?!-continue)/g)).toBe(1);
    expect(countMatches(footer, /charts-side-panel__action--expand-continue/g)).toBe(1);
    expect(footer).toContain('Ctrl+Enter: 保存 / 保存して閉じる: 保存後に一覧へ戻る / 保存して続ける: 入力を保持 / 保存して追加: 新規入力へ');
    expect(footer).toContain('aria-keyshortcuts="Control+Enter"');
  });

  it('keeps one visually strongest save action in the prescription order editor footer', () => {
    const footer = extractSaveFooter(readSource('../PrescriptionOrderEditorPanel.tsx'));

    expect(countMatches(footer, /charts-side-panel__action--save/g)).toBe(1);
    expect(countMatches(footer, /charts-side-panel__action--expand(?!-continue)/g)).toBe(1);
    expect(countMatches(footer, /charts-side-panel__action--expand-continue/g)).toBe(1);
    expect(footer).toContain('Shift+Enter: 請求用コメント確定 / 保存して閉じる: 保存後にドロワーを閉じます');
  });

  it('maps the strongest order action to a distinct filled visual token', () => {
    const styles = readSource('../styles.ts');

    expect(styles).toMatch(/\.charts-side-panel__action--save\s*\{[\s\S]*background: linear-gradient\(135deg, #dcfce7, #bbf7d0\);/);
    expect(styles).toMatch(/\.charts-side-panel__action--expand\s*\{[\s\S]*background: #eff6ff;/);
    expect(styles).toMatch(/\.charts-side-panel__action--expand-continue\s*\{[\s\S]*background: #ecfeff;/);
  });
});
