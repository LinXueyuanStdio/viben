#!/usr/bin/env node

/**
 * This script generates complete locale files by:
 * 1. Reading the English source (en.json)
 * 2. Reading existing translations for each language
 * 3. Merging them with English as fallback for missing keys
 * 4. Writing the complete files
 * 
 * Note: Missing keys will use English values and need manual translation.
 */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../apps/desktop/src/i18n/locales');

// Read English source
const enJson = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));

// Languages to process (excluding en and zh-CN which are complete)
const languages = [
  'ja', 'ko', 'de', 'fr', 'es', 'pt', 'it', 'nl', 
  'pl', 'ru', 'tr', 'vi', 'th', 'id', 'ms', 'hi', 'uk', 'sv'
];

// Deep merge function - source values override target values
function deepMerge(target, source) {
  const result = JSON.parse(JSON.stringify(target));
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// Count keys recursively
function countKeys(obj) {
  let count = 0;
  for (const key in obj) {
    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      count += countKeys(obj[key]);
    } else {
      count++;
    }
  }
  return count;
}

console.log('English source keys:', countKeys(enJson));
console.log('\nProcessing languages...\n');

for (const lang of languages) {
  const langPath = path.join(localesDir, `${lang}.json`);
  const existing = JSON.parse(fs.readFileSync(langPath, 'utf8'));
  
  const existingCount = countKeys(existing);
  
  // Merge: English as base, existing translations override
  const merged = deepMerge(enJson, existing);
  const mergedCount = countKeys(merged);
  
  // Write the merged file
  fs.writeFileSync(langPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  
  console.log(`${lang}: ${existingCount} -> ${mergedCount} keys (English fallback for ${mergedCount - existingCount} keys)`);
}

console.log('\nDone! All locale files now have complete key structure.');
console.log('Missing translations use English values as fallback.');
