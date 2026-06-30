const TS_LIKE = /\.(tsx?|jsx?|mts|cts)$/;

export async function extractAstContext({ file, source, line }) {
  const lines = source.split(/\r?\n/);
  const imports = collectImports(lines);
  const nearbySymbols = collectNearbySymbols(lines, line);
  const enclosing = findEnclosingSymbol(lines, line);
  const referencedNames = collectReferencedNames(lines, line);

  return {
    language: TS_LIKE.test(file) ? "typescript-like" : "unknown",
    enclosingSymbol: enclosing ? `${enclosing.kind} ${enclosing.name}` : "file scope",
    enclosingText: enclosing?.text || extractWindow(lines, line, 40),
    imports,
    nearbySymbols,
    referencedNames,
  };
}

function collectImports(lines) {
  const imports = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("import ") || /^export\s+\{/.test(trimmed)) {
      imports.push(trimmed);
    }
    if (imports.length >= 25) break;
  }
  return imports;
}

function collectNearbySymbols(lines, line) {
  const result = [];
  const start = Math.max(0, line - 35);
  const end = Math.min(lines.length, line + 35);

  for (let index = start; index < end; index += 1) {
    const symbol = parseSymbolLine(lines[index]);
    if (symbol) {
      result.push({
        ...symbol,
        startLine: index + 1,
        endLine: estimateBlockEnd(lines, index) + 1,
      });
    }
  }

  return result.slice(0, 30);
}

function findEnclosingSymbol(lines, line) {
  const targetIndex = line - 1;
  const candidates = [];

  for (let index = 0; index <= targetIndex; index += 1) {
    const symbol = parseSymbolLine(lines[index]);
    if (!symbol) continue;

    const endIndex = estimateBlockEnd(lines, index);
    if (targetIndex >= index && targetIndex <= endIndex) {
      candidates.push({
        ...symbol,
        startLine: index + 1,
        endLine: endIndex + 1,
        text: lines.slice(index, Math.min(endIndex + 1, index + 80)).join("\n"),
      });
    }
  }

  return candidates.sort((a, b) => (a.endLine - a.startLine) - (b.endLine - b.startLine))[0];
}

function parseSymbolLine(line) {
  const trimmed = line.trim();
  const patterns = [
    { kind: "function", regex: /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/ },
    { kind: "class", regex: /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/ },
    { kind: "interface", regex: /^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/ },
    { kind: "type", regex: /^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/ },
    { kind: "variable", regex: /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=/ },
    { kind: "method", regex: /^(?:public\s+|private\s+|protected\s+)?(?:async\s+)?(?!if\b|for\b|while\b|switch\b|catch\b)([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/ },
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern.regex);
    if (match) return { kind: pattern.kind, name: match[1] };
  }

  return null;
}

function estimateBlockEnd(lines, startIndex) {
  let depth = 0;
  let seenOpening = false;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = stripStringsAndComments(lines[index]);
    for (const char of line) {
      if (char === "{") {
        depth += 1;
        seenOpening = true;
      }
      if (char === "}") {
        depth -= 1;
        if (seenOpening && depth <= 0) return index;
      }
    }
    if (!seenOpening && index > startIndex + 8) return index;
  }

  return Math.min(lines.length - 1, startIndex + 80);
}

function collectReferencedNames(lines, line) {
  const text = extractWindow(lines, line, 30);
  const names = new Set();
  const matches = text.matchAll(/\b[A-Za-z_$][\w$]{2,}\b/g);

  for (const match of matches) {
    const name = match[0];
    if (!STOP_WORDS.has(name)) names.add(name);
    if (names.size >= 80) break;
  }

  return [...names];
}

function extractWindow(lines, line, radius) {
  const start = Math.max(0, line - radius);
  const end = Math.min(lines.length, line + radius);
  return lines.slice(start, end).join("\n");
}

function stripStringsAndComments(line) {
  return line
    .replace(/\/\/.*$/, "")
    .replace(/"[^"]*"/g, "\"\"")
    .replace(/'[^']*'/g, "''")
    .replace(/`[^`]*`/g, "``");
}

const STOP_WORDS = new Set([
  "const",
  "let",
  "var",
  "true",
  "false",
  "null",
  "undefined",
  "return",
  "throw",
  "async",
  "await",
  "function",
  "class",
  "interface",
  "type",
  "import",
  "export",
  "from",
]);
