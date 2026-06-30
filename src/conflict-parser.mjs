export function parseConflictBlocks(source) {
  const lines = source.split(/\r?\n/);
  const blocks = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].startsWith("<<<<<<<")) continue;

    const startLine = i + 1;
    const oursLabel = lines[i].replace(/^<<<<<<<\s*/, "").trim() || "ours";
    const ours = [];
    const base = [];
    const theirs = [];
    let theirsLabel = "theirs";
    let section = "ours";
    let endLine = startLine;

    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.startsWith("|||||||")) {
        section = "base";
        continue;
      }
      if (line.startsWith("=======")) {
        section = "theirs";
        continue;
      }
      if (line.startsWith(">>>>>>>")) {
        theirsLabel = line.replace(/^>>>>>>>\s*/, "").trim() || "theirs";
        endLine = j + 1;
        i = j;
        break;
      }
      if (section === "ours") ours.push(line);
      if (section === "base") base.push(line);
      if (section === "theirs") theirs.push(line);
    }

    blocks.push({
      startLine,
      endLine,
      startIndex: startLine - 1,
      endIndex: endLine - 1,
      oursLabel,
      theirsLabel,
      hasBase: base.length > 0,
      ours: ours.join("\n"),
      base: base.join("\n"),
      theirs: theirs.join("\n"),
    });
  }

  return blocks;
}
