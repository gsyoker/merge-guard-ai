export function buildMergeOptions({ block, context, featureImpact, risk }) {
  const bothLikelyUseful = hasDistinctIntent(block.ours, block.theirs);
  const options = [];

  options.push({
    id: "recommended",
    title: bothLikelyUseful ? "Keep both functional intents" : "Ask agent to synthesize a safe merged version",
    recommended: risk.level !== "high",
    automation: risk.level === "low" ? "auto_apply_allowed" : "requires_user_confirmation",
    explanation: bothLikelyUseful
      ? "Both sides appear to add or preserve behavior. A coding agent should merge the branches and keep validation, API calls, and state handling intact."
      : "The conflict may edit the same behavior. Ask the coding agent to produce a merged patch and explain which behavior is preserved.",
    nextChecks: checksFor(featureImpact.hints, risk.level),
  });

  options.push({
    id: "keep_ours",
    title: `Keep ${block.oursLabel || "ours"}`,
    recommended: false,
    automation: "manual_confirmation_required",
    explanation: "Use only the current branch side. This is fastest, but may drop useful behavior from the target branch.",
    nextChecks: checksFor(featureImpact.hints, "medium"),
  });

  options.push({
    id: "keep_theirs",
    title: `Keep ${block.theirsLabel || "theirs"}`,
    recommended: false,
    automation: "manual_confirmation_required",
    explanation: "Use only the incoming branch side. This may overwrite local feature work.",
    nextChecks: checksFor(featureImpact.hints, "medium"),
  });

  if (risk.level === "high") {
    options.unshift({
      id: "explain_only",
      title: "Explain first, do not auto-merge",
      recommended: true,
      automation: "blocked_until_user_confirms",
      explanation: `This touches ${featureImpact.likelyFeature}. High-risk areas should be reviewed before any patch is applied.`,
      nextChecks: checksFor(featureImpact.hints, "high"),
    });
  }

  return options;
}

function hasDistinctIntent(ours, theirs) {
  const oursCalls = collectCalls(ours);
  const theirsCalls = collectCalls(theirs);
  return [...oursCalls].some((call) => !theirsCalls.has(call)) || [...theirsCalls].some((call) => !oursCalls.has(call));
}

function collectCalls(text) {
  const calls = new Set();
  for (const match of text.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!CONTROL_WORDS.has(match[1])) calls.add(match[1]);
  }
  return calls;
}

function checksFor(hints, riskLevel) {
  const checks = new Set(["parse conflict result", "run related unit tests"]);
  if (riskLevel !== "low") checks.add("run typecheck or build");
  if (hints.some((hint) => ["auth", "login", "password", "token", "permission", "role"].includes(hint))) {
    checks.add("verify auth and permission flows");
  }
  if (hints.some((hint) => ["pay", "payment", "order", "refund", "wallet"].includes(hint))) {
    checks.add("verify order and payment state transitions");
  }
  if (hints.some((hint) => ["api", "schema", "type"].includes(hint))) {
    checks.add("verify API contract and generated types");
  }
  return [...checks];
}

const CONTROL_WORDS = new Set(["if", "for", "while", "switch", "catch"]);
