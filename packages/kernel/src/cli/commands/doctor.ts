import { wantsHelp } from './helpers.js'
import { isJsonMode, jsonSuccess, muteForJson } from '../output.js'

/**
 * `viben doctor` — Run system diagnostics and optionally fix issues.
 *
 * In dry-run mode (or with --json), checks are reported but no fixes are applied.
 * In interactive mode, fixable issues prompt the user before applying.
 * Exits with code 1 if any check fails.
 */
export async function cmdDoctor(args: string[], instanceRoot?: string): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  if (!json && wantsHelp(args)) {
    console.log(`
\x1b[1mviben doctor\x1b[0m — Run system diagnostics

\x1b[1mUsage:\x1b[0m
  viben doctor [--dry-run]

\x1b[1mOptions:\x1b[0m
  --dry-run       Check only, don't apply any fixes
  --json          Output result as JSON
  -h, --help      Show this help message

Checks your Viben installation for common issues including
config validity, agent availability, dependencies, and connectivity.
Fixable issues can be auto-repaired when not using --dry-run.
`)
    return
  }

  const knownFlags = ["--dry-run", "--json"];
  const unknownFlags = args.filter(
    (a) => a.startsWith("--") && !knownFlags.includes(a),
  );
  if (!json && unknownFlags.length > 0) {
    const { suggestMatch } = await import('../suggest.js');
    for (const flag of unknownFlags) {
      const suggestion = suggestMatch(flag, knownFlags);
      console.error(`Unknown flag: ${flag}`);
      if (suggestion) console.error(`Did you mean: ${suggestion}?`);
    }
    process.exit(1);
  }

  // --json implies --dry-run
  const dryRun = args.includes("--dry-run") || json;
  const { DoctorEngine } = await import("../../core/doctor/index.js");
  const engine = new DoctorEngine({ dryRun, dataDir: instanceRoot });

  if (!json) console.log("\n🩺 Viben Doctor\n");

  const report = await engine.runAll();

  if (json) {
    jsonSuccess({
      categories: report.categories.map((c) => ({
        name: c.name,
        results: c.results.map((r) => ({ status: r.status, message: r.message })),
      })),
      summary: {
        passed: report.summary.passed,
        warnings: report.summary.warnings,
        failed: report.summary.failed,
      },
    })
  }

  // Render results
  const icons = { pass: "\x1b[32m✅\x1b[0m", warn: "\x1b[33m⚠️\x1b[0m", fail: "\x1b[31m❌\x1b[0m" };

  for (const category of report.categories) {
    console.log(`\x1b[1m\x1b[36m${category.name}\x1b[0m`);
    for (const result of category.results) {
      console.log(`  ${icons[result.status]} ${result.message}`);
    }
    console.log();
  }

  // Handle risky fixes
  if (report.pendingFixes.length > 0) {
    console.log("\x1b[1mFixable issues:\x1b[0m\n");
    for (const pending of report.pendingFixes) {
      if (dryRun) {
        console.log(`  🔧 ${pending.message} (use without --dry-run to fix)`);
      } else {
        const clack = await import("@clack/prompts");
        const shouldFix = await clack.confirm({
          message: `Fix: ${pending.message}?`,
          initialValue: false,
        });
        if (clack.isCancel(shouldFix) || !shouldFix) {
          continue;
        }
        const fixResult = await pending.fix();
        if (fixResult.success) {
          console.log(`  \x1b[32m✓ ${fixResult.message}\x1b[0m`);
        } else {
          console.log(`  \x1b[31m✗ Fix failed: ${fixResult.message}\x1b[0m`);
        }
      }
    }
    console.log();
  }

  // Summary
  const { passed, warnings, failed, fixed } = report.summary;
  const fixedStr = fixed > 0 ? `, ${fixed} fixed` : "";
  console.log(`Result: ${passed} passed, ${warnings} warnings, ${failed} failed${fixedStr}`);

  if (failed > 0) {
    process.exit(1);
  }
}
