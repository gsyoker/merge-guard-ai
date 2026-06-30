export function renderHumanReport(result) {
  const lines = [];
  lines.push("Merge Guard AI Report");
  lines.push("");
  lines.push(`Repository: ${result.root}`);
  lines.push(`Conflicts: ${result.summary.conflictCount}`);
  lines.push(`Highest risk: ${result.summary.highestRisk}`);
  lines.push("");

  if (!result.conflicts.length) {
    lines.push("No unresolved conflict markers were found.");
    lines.push("");
    lines.push("Next step: run this during pre-push, PR creation, or after a failed merge.");
    return lines.join("\n");
  }

  for (const [index, conflict] of result.conflicts.entries()) {
    if (conflict.error) {
      lines.push(`${index + 1}. ${conflict.file}`);
      lines.push(`   Error: ${conflict.error}`);
      lines.push("");
      continue;
    }

    lines.push(`${index + 1}. ${conflict.file}:${conflict.block.startLine}-${conflict.block.endLine}`);
    lines.push(`   Risk: ${conflict.risk.level}`);
    lines.push(`   Feature: ${conflict.featureImpact.likelyFeature}`);
    lines.push(`   Symbol: ${conflict.context.enclosingSymbol}`);
    lines.push(`   Ours: ${conflict.featureImpact.oursSummary}`);
    lines.push(`   Theirs: ${conflict.featureImpact.theirsSummary}`);
    lines.push(`   Why: ${conflict.risk.reasons.join("; ")}`);
    lines.push("");
    lines.push("   Suggested user choices:");
    for (const option of conflict.mergeOptions.slice(0, 4)) {
      const marker = option.recommended ? "recommended" : option.automation;
      lines.push(`   - ${option.id}: ${option.title} (${marker})`);
      lines.push(`     ${option.explanation}`);
    }
    lines.push("");
  }

  lines.push("Agent handoff:");
  lines.push("  Re-run with --json and pass conflicts[].agentInput to Codex, Claude Code, or an MCP wrapper.");
  return lines.join("\n");
}
