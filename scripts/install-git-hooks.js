#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// Check if git is installed
const gitCheck = spawnSync('git', ['--version'], { stdio: 'ignore' });
if (gitCheck.status !== 0) {
  process.exit(0);
}

// Check if we are inside a git repository
const revParse = spawnSync('git', ['-C', projectRoot, 'rev-parse', '--git-dir'], { stdio: 'ignore' });
if (revParse.status !== 0) {
  process.exit(0);
}

// Configure git hooks path
const result = spawnSync('git', ['-C', projectRoot, 'config', 'core.hooksPath', '.githooks'], {
  stdio: 'inherit',
});
if (result.status === 0) {
  process.exit(0);
}

process.stderr.write(
  "Could not configure Git hooks. Run 'git config core.hooksPath .githooks' manually.\n",
);
process.exit(1);
