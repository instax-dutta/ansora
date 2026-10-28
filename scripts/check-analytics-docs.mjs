#!/usr/bin/env node
/**
 * Verifies the DOX chain actually documents the analytics feature.
 *
 * A feature this size that only exists in code is a feature the next agent will
 * re-invent. This checks the minimum set of contracts that must be written
 * down: the child AGENTS.md, its parent indexes, the root rules, and the
 * operator-facing docs.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

/** Each requirement: [file, [regex, ...description]]. */
const REQUIREMENTS = [
  [
    "src/lib/analytics/AGENTS.md",
    [
      /## Purpose/,
      /## Local Contracts/,
      /no database/i,
      /publish|published/i,
      /ANALYTICS_API_KEY/,
    ],
  ],
  ["src/lib/AGENTS.md", [/analytics\//]],
  ["src/app/AGENTS.md", [/analytics/]],
  ["src/components/AGENTS.md", [/analytics/]],
  ["src/lib/content/AGENTS.md", [/analytics/i]],
  ["AGENTS.md", [/analytics/i]],
  ["README.md", [/Analytics/]],
  [".env.example", [/ANALYTICS_API_KEY/]],
];

let failed = false;
for (const [file, patterns] of REQUIREMENTS) {
  let text;
  try {
    text = await readFile(path.join(root, file), "utf8");
  } catch {
    console.error(`missing doc: ${file}`);
    failed = true;
    continue;
  }
  for (const pattern of patterns) {
    if (!pattern.test(text)) {
      console.error(`${file} does not document ${pattern}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("analytics docs verification failed");
  process.exit(1);
}

console.log("analytics docs verification passed");
