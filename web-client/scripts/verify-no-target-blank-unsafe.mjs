import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(rootDir, 'src');

const collectFiles = (dir, out = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, out);
      return;
    }
    if (!/\.(tsx|jsx|html?)$/i.test(entry.name)) return;
    out.push(fullPath);
  });
  return out;
};

const hasSafeRel = (tag) => {
  const relMatch = tag.match(/\brel\s*=\s*["']([^"']+)["']/i);
  if (!relMatch) return false;
  const tokens = relMatch[1]
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  return tokens.includes('noopener') && tokens.includes('noreferrer');
};

const violations = [];

collectFiles(srcDir).forEach((filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const pattern = /<[^>]*\btarget\s*=\s*["']_blank["'][^>]*>/gi;
  for (const match of content.matchAll(pattern)) {
    const tag = match[0];
    if (hasSafeRel(tag)) continue;
    const before = content.slice(0, match.index);
    const line = before.split('\n').length;
    violations.push({
      file: path.relative(rootDir, filePath),
      line,
      tag,
    });
  }
});

if (violations.length > 0) {
  console.error('[verify:no-target-blank-unsafe] unsafe target="_blank" links found:');
  violations.forEach((violation) => {
    console.error(`- ${violation.file}:${violation.line}: ${violation.tag}`);
  });
  process.exit(1);
}

console.log('[verify:no-target-blank-unsafe] 問題は検出されませんでした。');
