import fs from "node:fs/promises";
import path from "node:path";
import { findGitRoot, listConflictedFiles } from "./git.mjs";
import { parseConflictBlocks } from "./conflict-parser.mjs";
import { extractAstContext } from "./ast-context.mjs";
import { inferFeatureImpact, scoreRisk } from "./feature-heuristics.mjs";
import { buildMergeOptions } from "./merge-options.mjs";

const STRATEGIES = new Set(["keep_ours", "keep_theirs", "recommended", "agent"]);

export async function resolve(options = {}) {
  const strategy = options.strategy || "agent";
  if (!STRATEGIES.has(strategy)) {
    throw new Error(`Unknown resolve strategy "${strategy}". Use one of: ${[...STRATEGIES].join(", ")}`);
  }

  const root = await findGitRoot(process.cwd());
  const files = options.files?.length ? options.files : await listConflictedFiles(root);
  const results = [];

  for (const file of files) {
    const absolutePath = path.isAbsolute(file) ? file : path.join(root, file);
    const relativePath = path.relative(root, absolutePath);
    const source = await fs.readFile(absolutePath, "utf8");
    const blocks = parseConflictBlocks(source);

    if (!blocks.length) {
      results.push({ file: relativePath, changed: false, message: "No conflict markers found." });
      continue;
    }

    const enriched = [];
    for (const block of blocks) {
      const context = await extractAstContext({ file: relativePath, source, line: block.startLine });
      const featureImpact = inferFeatureImpact({ file: relativePath, block, context });
      const risk = scoreRisk({ file: relativePath, block, context, featureImpact });
      const mergeOptions = buildMergeOptions({ block, context, featureImpact, risk });
      enriched.push({ block, context, featureImpact, risk, mergeOptions });
    }

    if (strategy === "agent") {
      results.push({
        file: relativePath,
        changed: false,
        strategy,
        agentPrompt: buildAgentPrompt(relativePath, enriched),
      });
      continue;
    }

    const resolvedSource = applyResolution(source, enriched, strategy);
    if (resolvedSource !== source) {
      await fs.writeFile(absolutePath, resolvedSource, "utf8");
    }

    results.push({
      file: relativePath,
      changed: resolvedSource !== source,
      strategy,
      resolvedBlocks: enriched.length,
      risks: enriched.map((item) => item.risk.level),
    });
  }

  return {
    schemaVersion: "0.1",
    generatedAt: new Date().toISOString(),
    root,
    strategy,
    changedFiles: results.filter((item) => item.changed).map((item) => item.file),
    results,
  };
}

function applyResolution(source, enrichedBlocks, strategy) {
  const lines = source.split(/\r?\n/);
  const output = [];
  let cursor = 0;

  for (const item of enrichedBlocks) {
    output.push(...lines.slice(cursor, item.block.startIndex));
    output.push(...resolutionText(item, strategy).split("\n"));
    cursor = item.block.endIndex + 1;
  }

  output.push(...lines.slice(cursor));
  return output.join("\n");
}

function resolutionText(item, strategy) {
  if (strategy === "keep_ours") return item.block.ours;
  if (strategy === "keep_theirs") return item.block.theirs;

  const mergedBySharedFallback = mergeSharedReturnFallback(item.block.ours, item.block.theirs);
  if (mergedBySharedFallback) {
    return withReviewComment(item, mergedBySharedFallback);
  }

  const riskPrefix = item.risk.level === "high"
    ? ["    // MERGE-GUARD: high-risk automatic merge. Review this block before shipping."]
    : [];

  return [
    ...riskPrefix,
    item.block.ours,
    "",
    "    // MERGE-GUARD: kept incoming intent as well. Ask your coding agent to simplify this block if needed.",
    item.block.theirs,
  ].join("\n");
}

function mergeSharedReturnFallback(ours, theirs) {
  const oursLines = ours.split("\n");
  const theirsLines = theirs.split("\n");
  const oursReturn = findLastReturnCall(oursLines);
  const theirsReturn = findLastReturnCall(theirsLines);

  if (!oursReturn || !theirsReturn || oursReturn.callee !== theirsReturn.callee) {
    return "";
  }

  const oursPrefix = trimTrailingBlankLines(oursLines.slice(0, oursReturn.index));
  const theirsBlock = trimLeadingBlankLines(theirsLines);

  if (!oursPrefix.length || !theirsBlock.length) return "";

  return [...oursPrefix, ...theirsBlock].join("\n");
}

function findLastReturnCall(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const match = lines[index].match(/\breturn\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (match) return { index, callee: match[1] };
  }
  return null;
}

function withReviewComment(item, text) {
  if (item.risk.level !== "high") return text;
  return [
    inferIndent(text) + "// MERGE-GUARD: high-risk automatic merge. Review this block before shipping.",
    text,
  ].join("\n");
}

function inferIndent(text) {
  const line = text.split("\n").find((item) => item.trim());
  return line?.match(/^\s*/)?.[0] || "";
}

function trimTrailingBlankLines(lines) {
  const copy = [...lines];
  while (copy.length && !copy[copy.length - 1].trim()) copy.pop();
  return copy;
}

function trimLeadingBlankLines(lines) {
  const copy = [...lines];
  while (copy.length && !copy[0].trim()) copy.shift();
  return copy;
}

function buildAgentPrompt(file, enrichedBlocks) {
  const payload = enrichedBlocks.map((item) => ({
    file,
    symbol: item.context.enclosingSymbol,
    risk: item.risk,
    featureImpact: item.featureImpact,
    mergeOptions: item.mergeOptions,
    base: item.block.base,
    ours: item.block.ours,
    theirs: item.block.theirs,
    imports: item.context.imports,
    nearbySymbols: item.context.nearbySymbols,
    referencedNames: item.context.referencedNames,
  }));

  return [
    "You are the user's current coding agent. Resolve the following merge conflicts safely.",
    "",
    "Rules:",
    "- Preserve both functional intents when they are compatible.",
    "- Do not drop validation, auth, permission, payment, order, or data-write logic without explaining why.",
    "- Produce a concrete patch for the file.",
    "- After patching, remove all conflict markers and run the relevant checks.",
    "",
    "Conflict payload:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

export function renderResolveReport(result) {
  const lines = [];
  lines.push("Merge Guard AI Resolve Report");
  lines.push("");
  lines.push(`Strategy: ${result.strategy}`);
  lines.push(`Changed files: ${result.changedFiles.length}`);
  lines.push("");

  for (const item of result.results) {
    lines.push(`- ${item.file}`);
    if (item.strategy === "agent") {
      lines.push("  Generated agent prompt. No files were changed.");
    } else {
      lines.push(`  Changed: ${item.changed ? "yes" : "no"}`);
      lines.push(`  Resolved blocks: ${item.resolvedBlocks || 0}`);
      if (item.risks?.length) lines.push(`  Risks: ${item.risks.join(", ")}`);
    }
  }

  if (result.strategy === "agent") {
    lines.push("");
    lines.push("Agent prompt:");
    lines.push(result.results.map((item) => item.agentPrompt).filter(Boolean).join("\n\n---\n\n"));
  }

  return lines.join("\n");
}
