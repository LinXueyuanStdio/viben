#!/usr/bin/env node
/**
 * i18n locale sync script
 *
 * Usage:
 *   node scripts/sync-i18n.mjs                  # Dry-run: show missing keys
 *   node scripts/sync-i18n.mjs --write           # Write missing keys (English fallback)
 *   node scripts/sync-i18n.mjs --write --translate # Write + call AI to translate (future)
 *
 * en.json is the source of truth for key structure.
 * zh-CN.json is the source of truth for Chinese translations.
 * Other locale files will be synced to match en.json's key structure.
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const LOCALES_DIR = join(
  import.meta.dirname,
  "../apps/desktop/src/i18n/locales"
);
const SOURCE_LOCALE = "en.json";
const SKIP_LOCALES = new Set(["en.json", "zh-CN.json"]);

// ── helpers ──────────────────────────────────────────────────────────

/** Recursively collect all leaf key paths from a nested object */
function collectKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...collectKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/** Get a nested value by dot-path */
function getByPath(obj, path) {
  return path.split(".").reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

/** Set a nested value by dot-path, creating intermediate objects as needed */
function setByPath(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (current[key] === undefined || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

/** Find keys in `target` that exist in en.json but are NOT in en.json (extra keys) */
function findExtraKeys(sourceKeys, targetKeys) {
  const sourceSet = new Set(sourceKeys);
  return targetKeys.filter((k) => !sourceSet.has(k));
}

// ── main ─────────────────────────────────────────────────────────────

const doWrite = process.argv.includes("--write");
const showExtra = process.argv.includes("--extra");

// 1. Load source (en.json)
const enPath = join(LOCALES_DIR, SOURCE_LOCALE);
const enData = JSON.parse(readFileSync(enPath, "utf-8"));
const enKeys = collectKeys(enData);

console.log(`\n📋 Source: ${SOURCE_LOCALE} — ${enKeys.length} leaf keys\n`);

// 2. Process each locale
const localeFiles = readdirSync(LOCALES_DIR).filter(
  (f) => f.endsWith(".json") && !SKIP_LOCALES.has(f)
);

let totalMissing = 0;
let totalExtra = 0;

for (const file of localeFiles.sort()) {
  const filePath = join(LOCALES_DIR, file);
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  const dataKeys = collectKeys(data);

  // Find missing keys
  const missing = enKeys.filter((k) => getByPath(data, k) === undefined);

  // Find extra keys (in locale but not in en.json)
  const extra = showExtra ? findExtraKeys(enKeys, dataKeys) : [];

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✅ ${file} — all ${enKeys.length} keys present`);
    continue;
  }

  console.log(
    `⚠️  ${file} — ${missing.length} missing${extra.length ? `, ${extra.length} extra` : ""}`
  );

  if (missing.length > 0) {
    // Group by top-level namespace for readable output
    const byNs = {};
    for (const key of missing) {
      const ns = key.split(".")[0];
      if (!byNs[ns]) byNs[ns] = [];
      byNs[ns].push(key);
    }
    for (const [ns, keys] of Object.entries(byNs)) {
      console.log(`   ${ns}: ${keys.length} keys`);
      if (!doWrite) {
        // Show first 5 keys in dry-run
        for (const k of keys.slice(0, 5)) {
          console.log(`     - ${k}`);
        }
        if (keys.length > 5) console.log(`     ... and ${keys.length - 5} more`);
      }
    }
  }

  if (doWrite && missing.length > 0) {
    // Add missing keys with English fallback value
    for (const key of missing) {
      const enValue = getByPath(enData, key);
      setByPath(data, key, enValue);
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    console.log(`   ✏️  Written ${missing.length} keys (English fallback)`);
  }

  totalMissing += missing.length;
  totalExtra += extra.length;
}

console.log(`\n─────────────────────────────────────────`);
console.log(`Total missing: ${totalMissing} across ${localeFiles.length} locales`);
if (showExtra) console.log(`Total extra: ${totalExtra}`);
if (!doWrite && totalMissing > 0) {
  console.log(`\nRun with --write to add missing keys (English fallback).`);
}
console.log();
