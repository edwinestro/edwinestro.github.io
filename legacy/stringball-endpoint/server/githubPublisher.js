/* eslint-disable no-empty */
const fs = require('fs');

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function base64FromBuffer(buf) {
  return Buffer.from(buf).toString('base64');
}

async function githubRequest(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  if (!res.ok) {
    const msg = json && json.message ? json.message : text || res.statusText;
    const err = new Error(`GitHub API ${res.status}: ${msg}`);
    err.status = res.status;
    err.body = json || text;
    throw err;
  }
  return json;
}

async function getExistingSha({ owner, repo, path, branch, token }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replaceAll('%2F','/')}`
    + `?ref=${encodeURIComponent(branch)}`;

  try {
    const json = await githubRequest(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    return json && json.sha ? json.sha : null;
  } catch (e) {
    if (e && e.status === 404) return null;
    throw e;
  }
}

async function putContent({ owner, repo, path, branch, token, message, contentBase64, sha }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replaceAll('%2F','/')}`;

  return githubRequest(url, {
    method: 'PUT',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      branch,
      content: contentBase64,
      ...(sha ? { sha } : {}),
    }),
  });
}

async function publishLeaderboardToGitHub({
  game,
  best,
  entries,
  xlsxPathOnDisk,
}) {
  const token = requiredEnv('GITHUB_TOKEN');
  const owner = requiredEnv('GITHUB_OWNER');
  const repo = requiredEnv('GITHUB_REPO');
  const branch = process.env.GITHUB_BRANCH || 'main';

  const xlsxRepoPath = process.env.GITHUB_XLSX_PATH || 'Projects/games/thermal-drift/leaderboard.xlsx';
  const jsonRepoPath = process.env.GITHUB_JSON_PATH || 'Projects/games/thermal-drift/leaderboard.json';

  const stamp = new Date().toISOString();
  const commitMsg = `chore(leaderboard): ${game} best ${Math.floor(best)}m @ ${stamp}`;

  const xlsxBuf = fs.readFileSync(xlsxPathOnDisk);
  const xlsxB64 = base64FromBuffer(xlsxBuf);

  const jsonBuf = Buffer.from(JSON.stringify({
    game,
    best,
    updatedAt: stamp,
    entries,
  }, null, 2), 'utf8');
  const jsonB64 = base64FromBuffer(jsonBuf);

  // XLSX
  const xlsxSha = await getExistingSha({ owner, repo, path: xlsxRepoPath, branch, token });
  await putContent({ owner, repo, path: xlsxRepoPath, branch, token, message: commitMsg, contentBase64: xlsxB64, sha: xlsxSha });

  // JSON snapshot
  const jsonSha = await getExistingSha({ owner, repo, path: jsonRepoPath, branch, token });
  await putContent({ owner, repo, path: jsonRepoPath, branch, token, message: commitMsg, contentBase64: jsonB64, sha: jsonSha });

  return { ok: true, xlsxRepoPath, jsonRepoPath };
}

module.exports = {
  publishLeaderboardToGitHub,
};
