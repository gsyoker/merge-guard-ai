const HIGH_RISK = [
  "auth",
  "login",
  "password",
  "token",
  "permission",
  "role",
  "pay",
  "payment",
  "order",
  "refund",
  "wallet",
  "security",
  "encrypt",
  "database",
  "migration",
  "sql",
];

const MEDIUM_RISK = [
  "api",
  "route",
  "schema",
  "type",
  "form",
  "state",
  "validate",
  "config",
  "flag",
  "feature",
  "cache",
  "hook",
];

export function inferFeatureImpact({ file, block, context }) {
  const haystack = [
    file,
    block.base,
    block.ours,
    block.theirs,
    context.enclosingSymbol,
    context.referencedNames?.join(" ") || "",
  ].join("\n").toLowerCase();

  const hints = [];
  for (const keyword of [...HIGH_RISK, ...MEDIUM_RISK]) {
    if (haystack.includes(keyword)) hints.push(keyword);
  }

  const moduleHint = inferModuleFromPath(file);
  if (moduleHint) hints.unshift(moduleHint);

  return {
    likelyFeature: humanizeFeature(moduleHint || hints[0] || "unknown feature"),
    hints: [...new Set(hints)],
    oursSummary: summarizeSide(block.ours),
    theirsSummary: summarizeSide(block.theirs),
  };
}

export function scoreRisk({ file, block, context, featureImpact }) {
  const text = [
    file,
    block.ours,
    block.theirs,
    context.enclosingSymbol,
    featureImpact.hints.join(" "),
  ].join("\n").toLowerCase();

  const highMatches = HIGH_RISK.filter((keyword) => text.includes(keyword));
  const mediumMatches = MEDIUM_RISK.filter((keyword) => text.includes(keyword));
  const hasDeletion = /(^|\n)\s*(return|throw|if|else|await|set|delete|remove|validate|check)/i.test(block.ours)
    && /(^|\n)\s*$/m.test(block.theirs);

  if (highMatches.length || hasDeletion) {
    return {
      level: "high",
      reasons: [
        ...highMatches.map((keyword) => `touches high-risk keyword "${keyword}"`),
        ...(hasDeletion ? ["one side appears to remove control-flow or validation logic"] : []),
      ],
    };
  }

  if (mediumMatches.length || context.nearbySymbols?.length > 5) {
    return {
      level: "medium",
      reasons: [
        ...mediumMatches.slice(0, 4).map((keyword) => `touches medium-risk keyword "${keyword}"`),
        ...(context.nearbySymbols?.length > 5 ? ["conflict sits in a dense symbol area"] : []),
      ],
    };
  }

  return {
    level: "low",
    reasons: ["no high-risk feature keywords detected"],
  };
}

function inferModuleFromPath(file) {
  const parts = file.toLowerCase().split(/[\\/_.-]+/);
  return [...HIGH_RISK, ...MEDIUM_RISK].find((keyword) => parts.includes(keyword)) || "";
}

function humanizeFeature(value) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeSide(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "empty side";
  return lines.slice(0, 5).join(" ");
}
