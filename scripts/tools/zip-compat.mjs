#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = (year - 1980) << 9 | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('ZIP end of central directory not found');
}

export function listEntries(zipPath) {
  if (!fs.existsSync(zipPath)) return [];
  const buffer = fs.readFileSync(zipPath);
  return listEntriesFromBuffer(buffer);
}

function listEntriesFromBuffer(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('invalid ZIP central directory');
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    entries.push({ name, method, crc, compressedSize, uncompressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

export function readEntry(zipPath, entryName) {
  const buffer = fs.readFileSync(zipPath);
  const entry = listEntriesFromBuffer(buffer).find((candidate) => candidate.name === entryName);
  if (!entry) throw new Error(`ZIP entry not found: ${entryName}`);
  return readEntryFromBuffer(buffer, entry);
}

function readEntryFromBuffer(buffer, entry) {
  const offset = entry.localOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error(`invalid ZIP local header: ${entry.name}`);
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(data);
  if (entry.method === 8) return zlib.inflateRawSync(data);
  throw new Error(`unsupported ZIP compression method ${entry.method}: ${entry.name}`);
}

export function readAll(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  return Buffer.concat(listEntriesFromBuffer(buffer).map((entry) => readEntryFromBuffer(buffer, entry)));
}

function normalizeEntryName(name) {
  return name.replaceAll('\\', '/').replace(/^\.?\//, '');
}

function buildZip(entries) {
  const fileParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, day } = dosDateTime();

  for (const entry of entries) {
    const nameBuffer = Buffer.from(normalizeEntryName(entry.name), 'utf8');
    const data = Buffer.from(entry.data);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    fileParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, ...centralParts, eocd]);
}

export function addFiles(zipPath, filePaths, options = {}) {
  const existing = fs.existsSync(zipPath)
    ? listEntries(zipPath).map((entry) => ({ name: entry.name, data: readEntry(zipPath, entry.name) }))
    : [];
  const nextByName = new Map(existing.map((entry) => [entry.name, entry]));

  for (const filePath of filePaths) {
    const entryName = options.junkPaths ? path.basename(filePath) : normalizeEntryName(filePath);
    nextByName.set(entryName, { name: entryName, data: fs.readFileSync(filePath) });
  }

  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  fs.writeFileSync(zipPath, buildZip([...nextByName.values()]));
}

async function readStdinLines() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').split(/\r?\n/).filter(Boolean);
}

async function main() {
  const [command, zipPath, ...args] = process.argv.slice(2);
  if (!command || !zipPath) {
    console.error('usage: zip-compat.mjs <list|cat|create|create-from-stdin> <zip> [--junk-paths] [paths...]');
    process.exit(2);
  }

  if (command === 'list') {
    console.log(listEntries(zipPath).map((entry) => entry.name).join('\n'));
    return;
  }
  if (command === 'cat') {
    const entryName = args[0];
    process.stdout.write(entryName ? readEntry(zipPath, entryName) : readAll(zipPath));
    return;
  }
  if (command === 'create' || command === 'create-from-stdin') {
    const junkPaths = args[0] === '--junk-paths';
    const fileArgs = junkPaths ? args.slice(1) : args;
    const files = command === 'create-from-stdin' ? await readStdinLines() : fileArgs;
    addFiles(zipPath, files, { junkPaths });
    return;
  }

  console.error(`unknown command: ${command}`);
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1].replaceAll('\\', '/')}` || process.argv[1]?.endsWith('zip-compat.mjs')) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
