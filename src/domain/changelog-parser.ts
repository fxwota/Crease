export type ChangelogCommitType =
  | "feat"
  | "fix"
  | "security"
  | "perf"
  | "refactor"
  | "test"
  | "docs"
  | "build"
  | "chore"
  | "breaking"
  | "other";

export interface ChangelogEntry {
  type: ChangelogCommitType;
  scope: string | null;
  breaking: boolean;
  title: string;
  description: string;
  raw: string;
}

export interface ChangelogCategory {
  name: string;
  slug: string;
  entries: ChangelogEntry[];
}

export interface ChangelogRelease {
  version: string;
  date: string | null;
  codename: string | null;
  isUnreleased: boolean;
  isPrerelease: boolean;
  summary: string;
  totalChanges: number;
  breakingCount: number;
  typeCounts: Record<string, number>;
  categories: ChangelogCategory[];
}

export interface ParsedChangelog {
  title: string;
  intro: string;
  currentVersion: string;
  latestReleaseDate: string | null;
  totalReleases: number;
  totalChanges: number;
  typeCounts: Record<string, number>;
  unreleased: ChangelogRelease | null;
  releases: ChangelogRelease[];
}

const KNOWN_TYPES = new Set<ChangelogCommitType>([
  "feat",
  "fix",
  "security",
  "perf",
  "refactor",
  "test",
  "docs",
  "build",
  "chore",
  "breaking",
]);

function inferTypeFromCategory(categoryName: string): ChangelogCommitType {
  const lower = categoryName.toLowerCase();
  if (lower.includes("break")) return "breaking";
  if (lower.includes("feat") || lower.includes("added")) return "feat";
  if (lower.includes("fix")) return "fix";
  if (lower.includes("secur")) return "security";
  if (lower.includes("perf")) return "perf";
  if (lower.includes("refactor") || lower.includes("changed")) return "refactor";
  if (lower.includes("test") || lower.includes("verif")) return "test";
  if (lower.includes("doc")) return "docs";
  if (lower.includes("build") || lower.includes("tool") || lower.includes("ci")) return "build";
  if (lower.includes("chore")) return "chore";
  return "other";
}

function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseEntryBullet(rawBody: string, fallbackCategory: string): ChangelogEntry {
  let text = rawBody.trim();
  let type: ChangelogCommitType = inferTypeFromCategory(fallbackCategory);
  let scope: string | null = null;
  let breaking = false;

  // Match optional backticked or plain Conventional Commit prefix: `feat(crypto)!:` or feat(crypto):
  const ccMatch = /^`?([a-zA-Z]+)(?:\(([^)]+)\))?(!)?:\s*`?\s*(.+)$/.exec(text);
  if (ccMatch) {
    const rawType = (ccMatch[1] ?? "").toLowerCase() as ChangelogCommitType;
    if (KNOWN_TYPES.has(rawType)) {
      type = rawType;
    }
    scope = ccMatch[2]?.trim() || null;
    breaking = Boolean(ccMatch[3]) || type === "breaking";
    text = (ccMatch[4] ?? "").trim();
  }

  let title = text;
  let description = "";

  // Match bold title followed by em-dash / colon separator: **Title** — Description
  const boldDashMatch = /^\*\*([^*]+)\*\*\s*(?:[—–-]|[:])\s*(.+)$/.exec(text);
  if (boldDashMatch) {
    title = (boldDashMatch[1] ?? "").trim();
    description = (boldDashMatch[2] ?? "").trim();
  } else {
    const boldOnlyMatch = /^\*\*([^*]+)\*\*\s*(.*)$/.exec(text);
    if (boldOnlyMatch) {
      title = (boldOnlyMatch[1] ?? "").trim();
      description = (boldOnlyMatch[2] ?? "").trim();
    } else {
      const dashMatch = /^([^—–]+?)\s+[—–]\s+(.+)$/.exec(text);
      if (dashMatch) {
        title = (dashMatch[1] ?? "").trim();
        description = (dashMatch[2] ?? "").trim();
      }
    }
  }

  if (/\bBREAKING\s+CHANGE\b/i.test(rawBody)) {
    breaking = true;
  }

  return {
    type,
    scope,
    breaking,
    title,
    description,
    raw: rawBody.trim(),
  };
}

function finalizeRelease(release: ChangelogRelease): ChangelogRelease {
  const typeCounts: Record<string, number> = {};
  let totalChanges = 0;
  let breakingCount = 0;

  for (const cat of release.categories) {
    for (const entry of cat.entries) {
      totalChanges++;
      if (entry.breaking) breakingCount++;
      typeCounts[entry.type] = (typeCounts[entry.type] ?? 0) + 1;
    }
  }

  return {
    ...release,
    summary: release.summary.trim(),
    totalChanges,
    breakingCount,
    typeCounts,
  };
}

/**
 * Pure-edge Keep a Changelog + Conventional Commits Markdown parser.
 * Zero Node.js built-ins; runs identically in Cloudflare Workers (`workerd`) and Vitest.
 */
export function parseChangelogMarkdown(markdown: string): ParsedChangelog {
  const lines = markdown.split(/\r?\n/);

  let title = "Changelog";
  const introLines: string[] = [];
  let inIntro = true;

  let currentRelease: ChangelogRelease | null = null;
  let currentCategory: ChangelogCategory | null = null;
  const allReleases: ChangelogRelease[] = [];

  const pushCurrentRelease = () => {
    if (!currentRelease) return;
    allReleases.push(finalizeRelease(currentRelease));
    currentRelease = null;
    currentCategory = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Stop before footer reference links or governance legend
    if (/^##\s+Release Governance/i.test(line)) {
      pushCurrentRelease();
      break;
    }

    if (/^\[[^\]]+\]:\s+https?:\/\//.test(line)) {
      continue;
    }

    if (/^#\s+/.test(line) && inIntro && title === "Changelog") {
      title = line.replace(/^#\s+/, "").trim();
      continue;
    }

    // Release heading: ## [0.0.0] - 2026-04-12 — Codename  OR  ## [Unreleased]
    const releaseMatch = /^##\s+\[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?(?:\s*[—–-]\s*(.+))?$/.exec(line);
    if (releaseMatch) {
      inIntro = false;
      pushCurrentRelease();
      const version = (releaseMatch[1] ?? "").trim();
      const isUnreleased = version.toLowerCase() === "unreleased";
      const date = releaseMatch[2]?.trim() ?? null;
      const codename = releaseMatch[3]?.trim() ?? null;

      currentRelease = {
        version,
        date,
        codename,
        isUnreleased,
        isPrerelease: isUnreleased || version.startsWith("0.") || version.includes("-"),
        summary: "",
        totalChanges: 0,
        breakingCount: 0,
        typeCounts: {},
        categories: [],
      };
      continue;
    }

    if (inIntro) {
      if (line && line !== "---") {
        introLines.push(line);
      }
      continue;
    }

    if (!currentRelease) continue;

    // Category heading: ### Features / ### Security / ### Fixed
    const categoryMatch = /^###\s+(.+)$/.exec(line);
    if (categoryMatch) {
      const catName = (categoryMatch[1] ?? "").trim();
      currentCategory = {
        name: catName,
        slug: slugifyCategory(catName),
        entries: [],
      };
      currentRelease.categories.push(currentCategory);
      continue;
    }

    // Bullet item under category
    const bulletMatch = /^[-*]\s+(.+)$/.exec(line);
    if (bulletMatch) {
      if (!currentCategory) {
        currentCategory = { name: "General", slug: "general", entries: [] };
        currentRelease.categories.push(currentCategory);
      }
      currentCategory.entries.push(
        parseEntryBullet(bulletMatch[1] ?? "", currentCategory.name)
      );
      continue;
    }

    // Release summary paragraph (before first ### category, skipping dividers and italicized empty notes)
    if (!currentCategory && line && line !== "---" && !(line.startsWith("_") && line.endsWith("_"))) {
      currentRelease.summary = currentRelease.summary
        ? `${currentRelease.summary} ${line}`
        : line;
    }
  }

  pushCurrentRelease();

  const unreleased = allReleases.find((r) => r.isUnreleased) ?? null;
  const releases = allReleases.filter((r) => !r.isUnreleased);

  const globalTypeCounts: Record<string, number> = {};
  let totalChanges = 0;
  for (const rel of releases) {
    totalChanges += rel.totalChanges;
    for (const [k, v] of Object.entries(rel.typeCounts)) {
      globalTypeCounts[k] = (globalTypeCounts[k] ?? 0) + v;
    }
  }

  const latest = releases[0];

  return {
    title,
    intro: introLines.join(" "),
    currentVersion: latest?.version ?? "0.0.0",
    latestReleaseDate: latest?.date ?? null,
    totalReleases: releases.length,
    totalChanges,
    typeCounts: globalTypeCounts,
    unreleased,
    releases,
  };
}

export function filterParsedChangelog(
  parsed: ParsedChangelog,
  filters: {
    version?: string | undefined;
    type?: string | undefined;
    query?: string | undefined;
    includeUnreleased?: boolean | undefined;
  }
): ParsedChangelog {
  const typeFilter = filters.type?.trim().toLowerCase();
  const versionFilter = filters.version?.trim().toLowerCase();
  const q = filters.query?.trim().toLowerCase();

  const filterRelease = (rel: ChangelogRelease): ChangelogRelease | null => {
    if (versionFilter && rel.version.toLowerCase() !== versionFilter) {
      return null;
    }

    const categories: ChangelogCategory[] = [];
    for (const cat of rel.categories) {
      const entries = cat.entries.filter((entry) => {
        if (typeFilter && typeFilter !== "all") {
          if (typeFilter === "breaking") {
            if (!entry.breaking) return false;
          } else if (entry.type !== typeFilter) {
            return false;
          }
        }
        if (q) {
          const hay = `${entry.type} ${entry.scope ?? ""} ${entry.title} ${entry.description}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      if (entries.length > 0) {
        categories.push({ ...cat, entries });
      }
    }

    if ((typeFilter && typeFilter !== "all") || q) {
      if (categories.length === 0) return null;
    }

    return finalizeRelease({ ...rel, categories });
  };

  const filteredReleases = parsed.releases
    .map(filterRelease)
    .filter((r): r is ChangelogRelease => r !== null);

  const filteredUnreleased =
    filters.includeUnreleased && parsed.unreleased ? filterRelease(parsed.unreleased) : null;

  const typeCounts: Record<string, number> = {};
  let totalChanges = 0;
  for (const rel of filteredReleases) {
    totalChanges += rel.totalChanges;
    for (const [k, v] of Object.entries(rel.typeCounts)) {
      typeCounts[k] = (typeCounts[k] ?? 0) + v;
    }
  }

  return {
    ...parsed,
    totalReleases: filteredReleases.length,
    totalChanges,
    typeCounts,
    unreleased: filteredUnreleased,
    releases: filteredReleases,
  };
}
