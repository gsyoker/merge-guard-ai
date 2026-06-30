import fs from "node:fs/promises";
import path from "node:path";
import { findGitRoot, listConflictedFiles } from "./git.mjs";
import { parseConflictBlocks } from "./conflict-parser.mjs";
import { extractAstContext } from "./ast-context.mjs";
import { inferFeatureImpact, scoreRisk } from "./feature-heuristics.mjs";
import { buildMergeOptions } from "./merge-options.mjs";

export async function analyze(options = {}) {
  const root = await findGitRoot(process.cwd());
  const files = options.files?.length
    ? options.files
    : await listConflictedFiles(root);

  const conflicts = [];

  for (const file of files) {
    const absolutePath = path.isAbsolute(file) ? file : path.join(root, file);
    const relativePath = path.relative(root, absolutePath);
    let source = "";

    try {
      source = await fs.readFile(absolutePath, "utf8");
    } catch (error) {
      conflicts.push({
        file: relativePath,
        error: `Cannot read file: ${error.message}`,
      });
      continue;
    }

    const blocks = parseConflictBlocks(source);
    for (const block of blocks) {
      const context = await extractAstContext({
        file: relativePath,
        source,
        line: block.startLine,
      });
      const featureImpact = inferFeatureImpact({
        file: relativePath,
        block,
        context,
      });
      const risk = scoreRisk({
        file: relativePath,
        block,
        context,
        featureImpact,
      });
      const mergeOptions = buildMergeOptions({ block, context, featureImpact, risk });

      conflicts.push({
        file: relativePath,
        block,
        context,
        featureImpact,
        risk,
        mergeOptions,
        agentInput: {
          task: "analyze_merge_conflict",
          file: relativePath,
          symbol: context.enclosingSymbol,
          base: block.base,
          ours: block.ours,
          theirs: block.theirs,
          imports: context.imports,
          nearbySymbols: context.nearbySymbols,
          referencedNames: context.referencedNames,
          featureHints: featureImpact.hints,
          requestedOutput: {
            mergeOptions: true,
            patch: true,
            riskExplanationForNonDevelopers: true,
          },
        },
      });
    }
  }

  return {
    schemaVersion: "0.1",
    generatedAt: new Date().toISOString(),
    root,
    summary: summarize(conflicts),
    conflicts,
  };
}

function summarize(conflicts) {
  const realConflicts = conflicts.filter((item) => !item.error);
  const riskCounts = { high: 0, medium: 0, low: 0 };
  for (const conflict of realConflicts) {
    riskCounts[conflict.risk.level] += 1;
  }

  return {
    conflictCount: realConflicts.length,
    files: [...new Set(realConflicts.map((conflict) => conflict.file))],
    riskCounts,
    highestRisk: riskCounts.high ? "high" : riskCounts.medium ? "medium" : realConflicts.length ? "low" : "none",
  };
}
