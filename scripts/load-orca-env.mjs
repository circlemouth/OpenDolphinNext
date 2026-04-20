#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node scripts/load-orca-env.mjs <command> [args...]');
  process.exit(1);
}

const parseLine = (line) => {
  let trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  if (trimmed.startsWith('export ')) {
    trimmed = trimmed.slice(7).trim();
  }
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) return null;
  const key = match[1];
  let value = match[2].trim();
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  } else if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
    value = value
      .replace(/\\\\/g, '\\')
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
  }
  return [key, value];
};

const applyEnvFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const entry = parseLine(rawLine);
    if (!entry) continue;
    const [key, value] = entry;
    process.env[key] = value;
  }
};

const candidates = [];
if (process.env.ORCA_ENV_FILE) {
  candidates.push(process.env.ORCA_ENV_FILE);
} else {
  candidates.push(path.join(repoRoot, 'orca.env.local'));
  candidates.push(path.join(os.homedir(), '.config', 'opendolphin', 'orca.env'));
}

let loadedPath = null;
for (const candidate of candidates) {
  if (!candidate) continue;
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
  applyEnvFile(candidate);
  loadedPath = candidate;
  break;
}

if (!loadedPath && process.env.ORCA_ENV_FILE) {
  console.error(`ORCA_ENV_FILE is set but not readable: ${process.env.ORCA_ENV_FILE}`);
  process.exit(1);
}

if (!loadedPath) {
  console.error('Warning: ORCA env file not found. Looked for ./orca.env.local and ~/.config/opendolphin/orca.env.');
}

const [command, ...commandArgs] = args;
const child = spawn(command, commandArgs, {
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
