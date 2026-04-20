#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { listEntries, readAll, readEntry } from './zip-compat.mjs';

const zipPath = process.argv[2];

if (!zipPath) {
  console.error('usage: scan-review-bundle.mjs <review-bundle.zip>');
  process.exit(2);
}

if (!existsSync(zipPath)) {
  console.error(`review bundle not found: ${zipPath}`);
  process.exit(2);
}

const entries = listEntries(zipPath).map((entry) => entry.name);

const forbiddenPathPattern =
  /^(?:\.git\/|client\/|server\/|artifacts\/|web-client\/artifacts\/|node_modules\/|dist\/|target\/|build\/|out\/|tmp\/|output\/|coverage\/|test-results\/)|\/(?:\.git|node_modules|dist|target|build|out|tmp|output|coverage|test-results|har|traces?|videos?|raw-screenshots?|screenshots?|raw-network-dumps?|network|requests|request-xml|response-xml)\/|(?:^|\/).*\.(?:zip|har)$/i;

const forbiddenPath = entries.find((entry) => forbiddenPathPattern.test(entry));
if (forbiddenPath) {
  console.error(`forbidden raw/generated path found in bundle: ${forbiddenPath}`);
  process.exit(1);
}

const secretLiteralRules = [
  {
    name: 'authorization-value',
    pattern:
      /\bauthorization\b\s*[:=]\s*['"]?(?:Basic|Bearer)\s+(?!(?:should-not-ship|REPLACE_WITH|[{<]))[A-Za-z0-9._~+/=-]{8,}/i,
  },
  {
    name: 'set-cookie-value',
    pattern: /\bset-cookie\b\s*:\s*[^;\s=]+=(?!(?:should-not-ship|REPLACE_WITH|[$\{<]|secret\b))[^;\s]{8,}/i,
  },
  {
    name: 'cookie-value',
    pattern: /(^|\s)cookie\s*:\s*[^;\s=]+=(?!(?:should-not-ship|REPLACE_WITH|[$\{<]|secret\b))[^;\s]{8,}/i,
  },
  {
    name: 'jsessionid-value',
    pattern:
      /\bjsessionid\b\s*[=:]\s*(?!(?:should-not-ship|REPLACE_WITH|jsessionid\[|[$\{<]|secret\b))[A-Za-z0-9._-]{8,}/i,
  },
  {
    name: 'csrf-token-value',
    pattern:
      /\b(?:x-csrf-token|csrf[-_]?token)\b[\s"_-]*[:=]\s*['"]?(?!(?:should-not-ship|REPLACE_WITH|[$\{<]|null\b|csrfToken\b|extract|refreshed|scenario|Boolean))[A-Za-z0-9._-]{24,}/i,
  },
  {
    name: 'raw-session-value',
    pattern:
      /\b(?:raw[-_]?session|session[-_]?id|session_id)\b[\s"_-]*[:=]\s*['"]?(?!(?:should-not-ship|REPLACE_WITH|[$\{<]|null\b|response|session|scenario|Boolean))[A-Za-z0-9._-]{24,}/i,
  },
  {
    name: 'credential-bearing-url',
    pattern: /[A-Za-z][A-Za-z0-9+.-]*:\/\/(?![$\{<])[^/?#\s@]+:(?![$\{<])[^/?#\s@]+@/i,
  },
];

const passwordAssignmentPattern = /\b(?:raw[-_]?password|password|passwd)\b[\s"_-]*[:=]/i;

function passwordValueIsPlaceholder(value) {
  if (!value) return true;
  if (value === '=') return true;
  if (/[^\x00-\x7F]/.test(value)) return true;
  if (/^[$<{]/.test(value)) return true;
  if (/^\(raw/i.test(value)) return true;
  if (/^[A-Za-z0-9_]+[(]/i.test(value)) return true;
  if (/^[A-Z0-9_]+[})]?$/i.test(value)) return true;
  if (/^[A-Za-z0-9_]+(?:[.]?[?]?[.][A-Za-z0-9_]+)+[(]?$/i.test(value)) return true;
  if (/^[A-Za-z0-9_]+ is required/i.test(value)) return true;
  return /^(?:required|string|boolean|null|undefined|password|rawPassword|passwordPlain|example(?:[-_][A-Za-z0-9_-]+)?|placeholder|redacted|masked|not_verified|not claimed|should-not-ship|your_|your-|changeme|change_me|sample|dummy|test)$/i.test(
    value,
  );
}

function extractPasswordValue(line) {
  const prefixPattern = /^.*\b(?:raw[-_]?password|password|passwd)\b[\s"_-]*[:=][\s"']*/i;
  const value = line.replace(prefixPattern, '').trim();
  return value.split(/[,\s;}'")\]]/, 1)[0] ?? '';
}

const combinedContent = readAll(zipPath).toString('utf8');

for (const { name, pattern } of secretLiteralRules) {
  if (pattern.test(combinedContent)) {
    console.error(`forbidden secret literal in bundle rule=${name}`);
    process.exit(1);
  }
}

const passwordScannedEntryPattern = /\.(?:md|txt|json|xml|ya?ml|toml|env|sample|sh|ps1|csv|log|properties|conf|http|sql)$/i;

for (const entry of entries) {
  if (!passwordScannedEntryPattern.test(entry)) continue;

  let content;
  try {
    content = readEntry(zipPath, entry).toString('utf8');
  } catch {
    continue;
  }

  for (const line of content.split(/\r?\n/)) {
    if (!passwordAssignmentPattern.test(line)) continue;
    const value = extractPasswordValue(line);
    if (!passwordValueIsPlaceholder(value)) {
      console.error(`forbidden password literal in bundle entry=${entry}`);
      process.exit(1);
    }
  }
}

console.log(`review bundle included source scope secret scan passed: ${zipPath}`);
