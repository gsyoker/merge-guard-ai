import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { analyze } from "./analyzer.mjs";
import { renderHumanReport } from "./report.mjs";
import { renderResolveReport, resolve } from "./resolver.mjs";

const STRATEGY_CHOICES = [
  { key: "1", strategy: "recommended", label: "Recommended: keep both functional intents" },
  { key: "2", strategy: "agent", label: "Agent: hand off to the current coding agent" },
  { key: "3", strategy: "keep_ours", label: "Keep ours: current branch only" },
  { key: "4", strategy: "keep_theirs", label: "Keep theirs: incoming branch only" },
];

export async function runInteractiveResolve(options = {}) {
  const files = options.files || [];
  const prompt = createPromptReader();

  try {
    const analysis = await analyze({ files });
    output.write(renderHumanReport(analysis));
    output.write("\n\n");

    if (!analysis.summary.conflictCount) {
      output.write("No unresolved conflict markers found.\n");
      return;
    }

    output.write("Choose a resolution strategy:\n");
    for (const choice of STRATEGY_CHOICES) {
      output.write(`  ${choice.key}. ${choice.label}\n`);
    }

    const selected = await prompt.ask("Select [1]: ");
    const strategy = findStrategy(selected || "1");
    output.write(`\nPreviewing strategy: ${strategy}\n\n`);

    const preview = await resolve({ files, strategy, apply: false });
    output.write(renderResolveReport(preview));
    output.write("\n");

    if (strategy === "agent" || !preview.changedFiles.length) return;

    const answer = await prompt.ask("\nApply this resolution and create a backup? [y/N]: ");
    if (!isYes(answer)) {
      output.write("Canceled. No files were changed.\n");
      return;
    }

    const applied = await resolve({ files, strategy, apply: true });
    output.write("\n");
    output.write(renderResolveReport(applied));
    output.write("\n\nNext: run your tests, review the diff, then commit.\n");
  } finally {
    prompt.close();
  }
}

function createPromptReader() {
  if (!input.isTTY) {
    const answers = fs.readFileSync(0, "utf8").split(/\r?\n/);
    return {
      ask(prompt) {
        output.write(prompt);
        const answer = answers.shift() || "";
        output.write(`${answer}\n`);
        return Promise.resolve(answer.trim());
      },
      close() {},
    };
  }

  const rl = readline.createInterface({ input, output });
  return {
    async ask(prompt) {
      return (await rl.question(prompt)).trim();
    },
    close() {
      rl.close();
    },
  };
}

function findStrategy(value) {
  const choice = STRATEGY_CHOICES.find((item) => item.key === value || item.strategy === value);
  if (!choice) return "recommended";
  return choice.strategy;
}

function isYes(value) {
  return ["y", "yes"].includes(value.trim().toLowerCase());
}
