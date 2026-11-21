import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

interface Violation {
  file: string;
  line: number;
  rule: string;
  snippet: string;
}

const NODE_BUILTIN_IMPORT_RX =
  /\bfrom\s+["'](?:node:[^"']+|fs|path|crypto|http|https|buffer|stream|url|os)["']/;
const BUFFER_GLOBAL_RX = /\bBuffer\.(?:from|alloc|concat|isBuffer|byteLength)\b/;
const BUN_GLOBAL_RX = /\bBun\./;
const PROCESS_GLOBAL_RX = /\bprocess\.(?:env|cwd|memoryUsage|uptime|argv|exit)\b/;
const EXPLICIT_ANY_RX = /:\s*any\b|\bas\s+any\b|<any>/;
const LEGACY_BRAND_RX = /\bsportify\b/i;

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkTsFiles(full, acc);
    } else if (entry.endsWith(".ts")) {
      acc.push(full);
    }
  }
  return acc;
}

const violations: Violation[] = [];

for (const file of walkTsFiles("src")) {
  const isGeneratedMarkdown = file.endsWith("changelog-raw.ts");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    const ln = idx + 1;
    if (!isGeneratedMarkdown && NODE_BUILTIN_IMPORT_RX.test(line)) {
      violations.push({ file, line: ln, rule: "no-node-builtins-in-worker", snippet: line.trim() });
    }
    if (!isGeneratedMarkdown && BUFFER_GLOBAL_RX.test(line)) {
      violations.push({ file, line: ln, rule: "no-node-buffer-in-worker", snippet: line.trim() });
    }
    if (!isGeneratedMarkdown && BUN_GLOBAL_RX.test(line)) {
      violations.push({ file, line: ln, rule: "no-bun-api-in-worker", snippet: line.trim() });
    }
    if (!isGeneratedMarkdown && PROCESS_GLOBAL_RX.test(line)) {
      violations.push({ file, line: ln, rule: "no-process-global-in-worker", snippet: line.trim() });
    }
    if (!isGeneratedMarkdown && EXPLICIT_ANY_RX.test(line)) {
      violations.push({ file, line: ln, rule: "no-explicit-any", snippet: line.trim() });
    }
    if (LEGACY_BRAND_RX.test(line)) {
      violations.push({ file, line: ln, rule: "no-legacy-brand-leakage", snippet: line.trim() });
    }
  });
}

for (const file of walkTsFiles("tests")) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    const ln = idx + 1;
    if (EXPLICIT_ANY_RX.test(line)) {
      violations.push({ file, line: ln, rule: "no-explicit-any", snippet: line.trim() });
    }
    if (LEGACY_BRAND_RX.test(line)) {
      violations.push({ file, line: ln, rule: "no-legacy-brand-leakage", snippet: line.trim() });
    }
  });
}

// Verify SemVer lockstep across package.json, src/config/env.ts, and CHANGELOG.md
const pkgJson = JSON.parse(readFileSync("package.json", "utf8")) as { version?: string };
const envSrc = readFileSync("src/config/env.ts", "utf8");
const envVersion = /export const APP_VERSION = "([^"]+)";/.exec(envSrc)?.[1] ?? "";
const changelogMd = readFileSync("CHANGELOG.md", "utf8").replace(/\r\n/g, "\n");
const changelogVersion = /^##\s+\[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]/m.exec(changelogMd)?.[1] ?? "";

if (pkgJson.version !== envVersion) {
  violations.push({
    file: "src/config/env.ts",
    line: 1,
    rule: "version-lockstep",
    snippet: `APP_VERSION (${envVersion}) !== package.json (${pkgJson.version ?? "missing"})`,
  });
}
if (pkgJson.version !== changelogVersion) {
  violations.push({
    file: "CHANGELOG.md",
    line: 1,
    rule: "changelog-version-lockstep",
    snippet: `Latest CHANGELOG.md version (${changelogVersion}) !== package.json (${pkgJson.version ?? "missing"})`,
  });
}

const rawTs = readFileSync("src/config/changelog-raw.ts", "utf8");
const expectedRawSnippet = `export const RAW_CHANGELOG_MD = ${JSON.stringify(changelogMd)};`;
if (!rawTs.includes(expectedRawSnippet)) {
  violations.push({
    file: "src/config/changelog-raw.ts",
    line: 1,
    rule: "changelog-sync-drift",
    snippet: "Out of sync with CHANGELOG.md — run `npm run changelog:sync`",
  });
}

if (violations.length > 0) {
  console.error(`Crease static lint failed with ${violations.length} violation(s):`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.snippet}`);
  }
  process.exit(1);
}

console.log(
  `Crease static lint passed: 0 violations (zero Node/Bun/Buffer in src/, zero any, zero legacy brand leakage, v${pkgJson.version} & CHANGELOG.md synced).`
);
