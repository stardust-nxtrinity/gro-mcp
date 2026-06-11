#!/usr/bin/env node

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const PROD_URL = 'https://api.gro.app/api/v1/mcp/public';
const STAGING_URL = 'https://test-api.gro.app/api/v1/mcp/public';

const isStaging = process.argv.includes('--staging');
const GRO_MCP_URL = isStaging ? STAGING_URL : PROD_URL;
const GRO_NAME = isStaging ? 'gro-staging' : 'gro';

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

console.log('');
console.log(bold('  Gro MCP Installer') + (isStaging ? yellow('  [staging]') : ''));
console.log(dim('  Connecting your AI assistant to Gro — ad creation, research & launch'));
console.log('');

const installed = [];
const skipped = [];

// ── Claude Code ────────────────────────────────────────────────────────────────
function tryClaudeCode() {
  const result = spawnSync('claude', ['--version'], { encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0 && result.error) return false;

  try {
    // Check if already installed
    const list = spawnSync('claude', ['mcp', 'list'], { encoding: 'utf8', stdio: 'pipe' });
    if (list.stdout && list.stdout.includes(GRO_NAME)) {
      skipped.push('Claude Code (already installed)');
      return true;
    }

    execSync(`claude mcp add ${GRO_NAME} ${GRO_MCP_URL} --transport http`, { stdio: 'pipe' });
    installed.push('Claude Code');
    return true;
  } catch (_) {
    return false;
  }
}

// ── Generic JSON config patcher ────────────────────────────────────────────────
function patchJsonConfig(configPath, clientName) {
  if (!existsSync(configPath)) return false;

  let config = {};
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (_) {
    return false;
  }

  config.mcpServers = config.mcpServers || {};

  if (config.mcpServers[GRO_NAME]) {
    skipped.push(`${clientName} (already installed)`);
    return true;
  }

  config.mcpServers[GRO_NAME] = {
    type: 'streamable-http',
    url: GRO_MCP_URL,
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  installed.push(clientName);
  return true;
}

// ── Claude Desktop ──────────────────────────────────────────────────────────────
function tryClaudeDesktop() {
  const home = homedir();
  const os = platform();
  const paths = os === 'win32'
    ? [join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json')]
    : os === 'darwin'
      ? [join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')]
      : [join(home, '.config', 'Claude', 'claude_desktop_config.json')];

  for (const p of paths) {
    if (patchJsonConfig(p, 'Claude Desktop')) return true;
  }
  return false;
}

// ── Cursor ──────────────────────────────────────────────────────────────────────
function tryCursor() {
  const home = homedir();
  const os = platform();
  const paths = os === 'win32'
    ? [join(process.env.APPDATA || '', 'Cursor', 'User', 'globalStorage', 'cursor.mcp', 'mcp.json')]
    : os === 'darwin'
      ? [join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'cursor.mcp', 'mcp.json'),
         join(home, '.cursor', 'mcp.json')]
      : [join(home, '.config', 'Cursor', 'User', 'globalStorage', 'cursor.mcp', 'mcp.json')];

  for (const p of paths) {
    if (patchJsonConfig(p, 'Cursor')) return true;
  }
  return false;
}

// ── Windsurf ────────────────────────────────────────────────────────────────────
function tryWindsurf() {
  const home = homedir();
  const os = platform();
  const paths = os === 'win32'
    ? [join(process.env.APPDATA || '', 'Windsurf', 'User', 'globalStorage', 'windsurf.mcp', 'mcp.json')]
    : os === 'darwin'
      ? [join(home, 'Library', 'Application Support', 'Windsurf', 'User', 'globalStorage', 'windsurf.mcp', 'mcp.json')]
      : [join(home, '.config', 'Windsurf', 'User', 'globalStorage', 'windsurf.mcp', 'mcp.json')];

  for (const p of paths) {
    if (patchJsonConfig(p, 'Windsurf')) return true;
  }
  return false;
}

// ── Run all detectors ───────────────────────────────────────────────────────────
const detectors = [
  ['Claude Code', tryClaudeCode],
  ['Claude Desktop', tryClaudeDesktop],
  ['Cursor', tryCursor],
  ['Windsurf', tryWindsurf],
];

for (const [name, fn] of detectors) {
  process.stdout.write(`  Checking ${name}… `);
  const found = fn();
  console.log(found ? '' : dim('not found'));
}

console.log('');

if (installed.length > 0) {
  for (const client of installed) {
    console.log(`  ${green('✓')} Installed for ${bold(client)}`);
  }
}

if (skipped.length > 0) {
  for (const client of skipped) {
    console.log(`  ${yellow('–')} ${client}`);
  }
}

if (installed.length === 0 && skipped.length === 0) {
  console.log(`  ${yellow('!')} No supported MCP clients found.`);
  console.log('');
  console.log('  Supported: Claude Code CLI, Claude Desktop, Cursor, Windsurf');
  console.log('  To add manually:');
  console.log(`    claude mcp add gro ${GRO_MCP_URL} --transport http`);
  process.exit(1);
}

console.log('');
if (isStaging) {
  console.log(`  ${bold('Staging mode:')} Connected to ${dim(STAGING_URL)}`);
} else {
  console.log(`  ${bold('Next:')} Open your AI assistant and ask Gro to create an ad for your product.`);
  console.log(`  ${dim('First-time users: Gro will prompt you to log in when you use your first tool.')}`);
}
console.log('');
