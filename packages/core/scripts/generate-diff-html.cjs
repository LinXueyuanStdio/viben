#!/usr/bin/env node
/**
 * Generate HTML diff comparison between Trellis and Viben outputs
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BUILD_DIR = path.join(__dirname, "..", "build");
const TRELLIS_DIR = path.join(BUILD_DIR, "trellis-test");
const VIBEN_DIR = path.join(BUILD_DIR, "viben-test");
const OUTPUT_HTML = path.join(BUILD_DIR, "index.html");

// Get all files recursively
function getAllFiles(dir, prefix = "") {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(path.join(dir, entry.name), fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files.sort();
}

// Escape HTML
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Get file content with error handling
function getFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// Normalize trellis content to viben for comparison
function normalizeToViben(content) {
  return content
    .replace(/\.trellis/g, ".viben")
    .replace(/\/trellis:/g, "/viben:")
    .replace(/trellis:/g, "viben:")
    .replace(/TRELLIS/g, "VIBEN")
    .replace(/Trellis/g, "Viben")
    .replace(/trellis/g, "viben");
}

// Transform trellis path to viben path
function trellisToVibenPath(p) {
  return p
    .replace(/^\.trellis/, ".viben")
    .replace(/\/trellis\//, "/viben/")
    .replace(/trellis-/, "viben-");
}

// Simple line-based diff
function generateLineDiff(oldContent, newContent, oldLabel, newLabel) {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  let html = '<div class="diff-view">';
  html += `<div class="diff-header"><span class="old-label">${escapeHtml(oldLabel)}</span> → <span class="new-label">${escapeHtml(newLabel)}</span></div>`;

  const maxLines = Math.max(oldLines.length, newLines.length);
  let diffCount = 0;

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || "";
    const newLine = newLines[i] || "";

    if (oldLine === newLine) {
      // Same line
      html += `<div class="line same"><span class="line-num">${i + 1}</span><span class="content">${escapeHtml(oldLine)}</span></div>`;
    } else {
      diffCount++;
      // Different lines
      if (oldLine) {
        html += `<div class="line removed"><span class="line-num">${i + 1}</span><span class="content">- ${escapeHtml(oldLine)}</span></div>`;
      }
      if (newLine) {
        html += `<div class="line added"><span class="line-num">${i + 1}</span><span class="content">+ ${escapeHtml(newLine)}</span></div>`;
      }
    }
  }

  html += '</div>';
  return { html, diffCount };
}

// Main
function main() {
  console.log("Generating diff comparison HTML...");

  const trellisFiles = getAllFiles(TRELLIS_DIR);
  const vibenFiles = getAllFiles(VIBEN_DIR);

  // Map trellis files to viben equivalent paths
  const trellisToViben = new Map();
  for (const tf of trellisFiles) {
    const vf = trellisToVibenPath(tf);
    trellisToViben.set(tf, vf);
  }

  // Build comparison data
  const comparisons = [];
  const stats = {
    total: 0,
    identical: 0,
    nameChangeOnly: 0,
    contentDiff: 0,
    trellisOnly: 0,
    vibenOnly: 0,
  };

  // Files in trellis
  for (const [trellisPath, vibenPath] of trellisToViben) {
    stats.total++;

    const trellisContent = getFileContent(path.join(TRELLIS_DIR, trellisPath));
    const vibenContent = getFileContent(path.join(VIBEN_DIR, vibenPath));

    if (!vibenContent) {
      stats.trellisOnly++;
      comparisons.push({
        type: "trellis-only",
        trellisPath,
        vibenPath,
        trellisContent,
      });
      continue;
    }

    // Normalize trellis content
    const normalizedTrellis = normalizeToViben(trellisContent);

    if (normalizedTrellis === vibenContent) {
      stats.nameChangeOnly++;
      comparisons.push({
        type: "name-change-only",
        trellisPath,
        vibenPath,
      });
    } else {
      stats.contentDiff++;
      comparisons.push({
        type: "content-diff",
        trellisPath,
        vibenPath,
        trellisContent: normalizedTrellis,
        vibenContent,
      });
    }
  }

  // Files only in viben
  const vibenPathSet = new Set(trellisToViben.values());
  for (const vf of vibenFiles) {
    if (!vibenPathSet.has(vf)) {
      stats.vibenOnly++;
      stats.total++;
      comparisons.push({
        type: "viben-only",
        vibenPath: vf,
        vibenContent: getFileContent(path.join(VIBEN_DIR, vf)),
      });
    }
  }

  // Generate HTML
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trellis vs Viben Diff Comparison</title>
  <style>
    :root {
      --bg: #1a1a2e;
      --card-bg: #16213e;
      --text: #eee;
      --text-muted: #888;
      --green: #4ade80;
      --red: #f87171;
      --yellow: #fbbf24;
      --blue: #60a5fa;
      --border: #333;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 20px;
      line-height: 1.6;
    }
    h1 {
      text-align: center;
      margin-bottom: 10px;
    }
    .subtitle {
      text-align: center;
      color: var(--text-muted);
      margin-bottom: 30px;
    }
    .stats {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 30px;
    }
    .stat {
      background: var(--card-bg);
      padding: 15px 25px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 2em;
      font-weight: bold;
    }
    .stat-label {
      color: var(--text-muted);
      font-size: 0.9em;
    }
    .stat.green .stat-value { color: var(--green); }
    .stat.yellow .stat-value { color: var(--yellow); }
    .stat.red .stat-value { color: var(--red); }
    .stat.blue .stat-value { color: var(--blue); }

    .filter-buttons {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .filter-btn {
      padding: 8px 16px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover, .filter-btn.active {
      background: var(--blue);
      border-color: var(--blue);
    }

    .comparison {
      background: var(--card-bg);
      border-radius: 8px;
      margin-bottom: 15px;
      overflow: hidden;
    }
    .comparison-header {
      padding: 15px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    }
    .comparison-header:hover {
      background: rgba(255,255,255,0.05);
    }
    .comparison-path {
      font-family: monospace;
      font-size: 0.95em;
    }
    .comparison-badge {
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: bold;
    }
    .badge-green { background: rgba(74, 222, 128, 0.2); color: var(--green); }
    .badge-yellow { background: rgba(251, 191, 36, 0.2); color: var(--yellow); }
    .badge-red { background: rgba(248, 113, 113, 0.2); color: var(--red); }
    .badge-blue { background: rgba(96, 165, 250, 0.2); color: var(--blue); }

    .comparison-content {
      display: none;
      padding: 15px 20px;
      border-top: 1px solid var(--border);
    }
    .comparison.expanded .comparison-content {
      display: block;
    }

    .diff-view {
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 12px;
      overflow-x: auto;
    }
    .diff-header {
      padding: 10px;
      background: rgba(0,0,0,0.3);
      border-radius: 4px 4px 0 0;
      margin-bottom: 5px;
    }
    .old-label { color: var(--red); }
    .new-label { color: var(--green); }
    .line {
      display: flex;
      padding: 2px 10px;
      white-space: pre;
    }
    .line-num {
      color: var(--text-muted);
      min-width: 40px;
      text-align: right;
      margin-right: 15px;
      user-select: none;
    }
    .line.same { opacity: 0.5; }
    .line.added { background: rgba(74, 222, 128, 0.15); color: var(--green); }
    .line.removed { background: rgba(248, 113, 113, 0.15); color: var(--red); }

    .file-content {
      background: rgba(0,0,0,0.2);
      padding: 15px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
      max-height: 400px;
      overflow: auto;
    }

    .arrow { transition: transform 0.2s; }
    .comparison.expanded .arrow { transform: rotate(90deg); }

    .hidden { display: none !important; }
  </style>
</head>
<body>
  <h1>Trellis vs Viben Diff Comparison</h1>
  <p class="subtitle">Comparing Trellis output with Viben (TypeScript) implementation</p>

  <div class="stats">
    <div class="stat green">
      <div class="stat-value">${stats.nameChangeOnly}</div>
      <div class="stat-label">Name Change Only</div>
    </div>
    <div class="stat yellow">
      <div class="stat-value">${stats.contentDiff}</div>
      <div class="stat-label">Content Diff</div>
    </div>
    <div class="stat red">
      <div class="stat-value">${stats.trellisOnly}</div>
      <div class="stat-label">Trellis Only</div>
    </div>
    <div class="stat blue">
      <div class="stat-value">${stats.vibenOnly}</div>
      <div class="stat-label">Viben Only</div>
    </div>
  </div>

  <div class="filter-buttons">
    <button class="filter-btn active" data-filter="all">All (${stats.total})</button>
    <button class="filter-btn" data-filter="name-change-only">Name Change Only (${stats.nameChangeOnly})</button>
    <button class="filter-btn" data-filter="content-diff">Content Diff (${stats.contentDiff})</button>
    <button class="filter-btn" data-filter="trellis-only">Trellis Only (${stats.trellisOnly})</button>
    <button class="filter-btn" data-filter="viben-only">Viben Only (${stats.vibenOnly})</button>
  </div>

  <div id="comparisons">`;

  // Generate comparison cards
  for (const comp of comparisons) {
    let badge, badgeClass, content;

    switch (comp.type) {
      case "name-change-only":
        badge = "Name Change Only";
        badgeClass = "badge-green";
        content = `<p style="color: var(--green)">✓ Content identical after trellis → viben name replacement</p>
          <p><strong>Trellis:</strong> ${escapeHtml(comp.trellisPath)}</p>
          <p><strong>Viben:</strong> ${escapeHtml(comp.vibenPath)}</p>`;
        break;

      case "content-diff":
        badge = "Content Diff";
        badgeClass = "badge-yellow";
        const diff = generateLineDiff(comp.trellisContent, comp.vibenContent, comp.trellisPath, comp.vibenPath);
        content = diff.html;
        break;

      case "trellis-only":
        badge = "Trellis Only";
        badgeClass = "badge-red";
        content = `<p style="color: var(--red)">✗ This file exists in Trellis but not in Viben output</p>
          <p><strong>Expected at:</strong> ${escapeHtml(comp.vibenPath)}</p>
          <div class="file-content">${escapeHtml(comp.trellisContent?.substring(0, 2000) || "(empty)")}</div>`;
        break;

      case "viben-only":
        badge = "Viben Only";
        badgeClass = "badge-blue";
        content = `<p style="color: var(--blue)">+ This file exists in Viben but not in Trellis output</p>
          <div class="file-content">${escapeHtml(comp.vibenContent?.substring(0, 2000) || "(empty)")}</div>`;
        break;
    }

    const displayPath = comp.vibenPath || comp.trellisPath;

    html += `
    <div class="comparison" data-type="${comp.type}">
      <div class="comparison-header" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="comparison-path">${escapeHtml(displayPath)}</span>
        <span>
          <span class="comparison-badge ${badgeClass}">${badge}</span>
          <span class="arrow">▶</span>
        </span>
      </div>
      <div class="comparison-content">
        ${content}
      </div>
    </div>`;
  }

  html += `
  </div>

  <script>
    // Filter functionality
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        document.querySelectorAll('.comparison').forEach(comp => {
          if (filter === 'all' || comp.dataset.type === filter) {
            comp.classList.remove('hidden');
          } else {
            comp.classList.add('hidden');
          }
        });
      });
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(OUTPUT_HTML, html);
  console.log(`\n✓ Generated: ${OUTPUT_HTML}`);
  console.log(`\nStats:`);
  console.log(`  Total files: ${stats.total}`);
  console.log(`  Name change only: ${stats.nameChangeOnly} (identical after normalization)`);
  console.log(`  Content diff: ${stats.contentDiff}`);
  console.log(`  Trellis only: ${stats.trellisOnly}`);
  console.log(`  Viben only: ${stats.vibenOnly}`);
}

main();
