const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const BadWords = require('bad-words');

const DB_PATH = path.resolve(__dirname, 'leaderboard.xlsx');
const MAX_ROWS_PER_GAME = 50;

// Single-process mutex to avoid overlapping writes.
let writeChain = Promise.resolve();

const profanity = new BadWords({
  // We'll keep the default list and add a few extra "keep it classy" terms.
  // NOTE: don't try to be perfect here; this is a lightweight filter.
  placeHolder: '*',
});

function looksLikeLinkOrEmail(s) {
  const t = String(s).toLowerCase();
  if (t.includes('http://') || t.includes('https://') || t.includes('www.')) return true;
  if (t.includes('@')) return true;
  return false;
}

function normalizeForProfanity(s) {
  // Normalize leetspeak and strip non-letters/digits to reduce obvious bypasses.
  return String(s)
    .toLowerCase()
    .replaceAll('0', 'o')
    .replaceAll('1', 'i')
    .replaceAll('3', 'e')
    .replaceAll('4', 'a')
    .replaceAll('5', 's')
    .replaceAll('7', 't')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeGame(game) {
  const g = String(game || '').trim().toLowerCase();
  // Keep sheet names stable and safe.
  if (!g) return null;
  if (!/^[a-z0-9-]{1,40}$/.test(g)) return null;
  return g;
}

function sanitizeName(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  // prevent sheet formula injection and keep it readable
  let clean = n.replace(/[\r\n\t]/g, ' ').slice(0, 32);
  // Excel formula injection protection: prefix if it starts with a formula token.
  if (/^[=+\-@]/.test(clean)) clean = `'${clean}`;

  // Basic safety rules
  if (looksLikeLinkOrEmail(clean)) return null;
  const normalized = normalizeForProfanity(clean);
  if (!normalized) return null;
  if (profanity.isProfane(normalized)) return null;

  return clean;
}

function sanitizeScore(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return null;
  if (s < 0) return 0;
  return Math.floor(s);
}

async function loadWorkbook() {
  const workbook = new ExcelJS.Workbook();
  if (fs.existsSync(DB_PATH)) {
    await workbook.xlsx.readFile(DB_PATH);
  }
  return workbook;
}

function ensureSheet(workbook, game) {
  // Excel sheet names: <= 31 chars, no special chars.
  const sheetName = game.slice(0, 31);
  let sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    sheet = workbook.addWorksheet(sheetName);
    sheet.columns = [
      { header: 'rank', key: 'rank', width: 8 },
      { header: 'name', key: 'name', width: 18 },
      { header: 'score', key: 'score', width: 10 },
      { header: 'at', key: 'at', width: 26 },
    ];
  }
  return sheet;
}

function readRows(sheet) {
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const name = row.getCell(2).value;
    const score = row.getCell(3).value;
    const at = row.getCell(4).value;
    if (!name || score === null || score === undefined) return;
    let displayName = String(name);
    // If we prefixed a leading apostrophe for Excel safety, don't show it in API/UI.
    if (/^'[=+\-@]/.test(displayName)) displayName = displayName.slice(1);
    rows.push({
      name: displayName,
      score: Number(score) || 0,
      at: at ? String(at) : '',
    });
  });
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

function writeRows(sheet, rows) {
  // Clear all data rows
  if (sheet.rowCount > 1) {
    sheet.spliceRows(2, sheet.rowCount - 1);
  }

  const top = rows.slice(0, MAX_ROWS_PER_GAME);
  for (let i = 0; i < top.length; i++) {
    sheet.addRow({
      rank: i + 1,
      name: top[i].name,
      score: top[i].score,
      at: top[i].at,
    });
  }
}

async function getLeaderboard(game, limit = 10) {
  const g = sanitizeGame(game);
  if (!g) throw new Error('invalid game');

  const workbook = await loadWorkbook();
  const sheet = ensureSheet(workbook, g);
  const rows = readRows(sheet);
  const top = rows.slice(0, Math.max(1, Math.min(50, Number(limit) || 10)));

  const best = top.length ? top[0].score : 0;
  return { game: g, best, entries: top.map((e, idx) => ({ rank: idx + 1, ...e })) };
}

async function submitScore({ game, name, score }) {
  const g = sanitizeGame(game);
  const n = sanitizeName(name);
  const s = sanitizeScore(score);

  if (!g) throw new Error('invalid game');
  if (!n) throw new Error('invalid name');
  if (s === null) throw new Error('invalid score');

  // Serialize write operations.
  writeChain = writeChain.then(async () => {
    const workbook = await loadWorkbook();
    const sheet = ensureSheet(workbook, g);
    const rows = readRows(sheet);

    rows.push({ name: n, score: s, at: new Date().toISOString() });
    rows.sort((a, b) => b.score - a.score);

    writeRows(sheet, rows);
    await workbook.xlsx.writeFile(DB_PATH);

    return true;
  });

  await writeChain;
  return getLeaderboard(g, 10);
}

module.exports = {
  getLeaderboard,
  submitScore,
};
