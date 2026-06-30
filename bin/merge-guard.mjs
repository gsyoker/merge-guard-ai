#!/usr/bin/env node

import { analyze } from "../src/analyzer.mjs";
import { installHooks } from "../src/hooks.mjs";
import { renderHumanReport } from "../src/report.mjs";
import { renderResolveReport, resolve } from "../src/resolver.mjs";

const args = process.argv.slice(2);
const command = args[0] || "analyze";

function hasFlag(name) {
  return args.includes(name);
}

function readListAfter(flag) {
  const index = args.indexOf(flag);
  if (index === -1) return [];
  const values = [];
  for (let i = index + 1; i < args.length; i += 1) {
    if (args[i].startsWith("--")) break;
    values.push(args[i]);
  }
  return values;
}

function readValueAfter(flag, fallback) {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return fallback;
  return args[index + 1];
}

async function main() {
  if (command === "analyze") {
    const result = await analyze({
      files: readListAfter("--files"),
      includeCleanScan: hasFlag("--scan"),
    });

    if (hasFlag("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(renderHumanReport(result));
    }

    const failOn = readValueAfter("--fail-on", "");
    if (failOn && shouldFail(result, failOn)) {
      process.exitCode = 2;
    }
    return;
  }

  if (command === "install-hooks") {
    const result = await installHooks();
    console.log(result.message);
    return;
  }

  if (command === "resolve") {
    const result = await resolve({
      files: readListAfter("--files"),
      strategy: readValueAfter("--strategy", "agent"),
    });

    if (hasFlag("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(renderResolveReport(result));
    }
    return;
  }

  if (command === "help" || hasFlag("--help")) {
    printHelp();
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exitCode = 1;
}

function shouldFail(result, failOn) {
  const ranks = { low: 1, medium: 2, high: 3 };
  const threshold = ranks[failOn] || 99;
  return result.conflicts.some((conflict) => ranks[conflict.risk.level] >= threshold);
}

function printHelp() {
  console.log(`Merge Guard AI

Usage:
  merge-guard analyze [--files <file...>] [--json] [--fail-on low|medium|high]
  merge-guard resolve [--files <file...>] [--strategy keep_ours|keep_theirs|recommended|agent] [--json]
  merge-guard install-hooks

Examples:
  node ./bin/merge-guard.mjs analyze
  node ./bin/merge-guard.mjs analyze --files src/pages/Login.tsx --json
  node ./bin/merge-guard.mjs resolve --files src/pages/Login.tsx --strategy keep_ours
  node ./bin/merge-guard.mjs resolve --strategy agent
  node ./bin/merge-guard.mjs install-hooks
`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
