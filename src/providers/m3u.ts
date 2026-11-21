import type { ClearKeyConfig } from "../domain/types";
import { parsePipeHeadersUrl } from "./base";
import { parseClearKeySpec } from "./drm";

export interface ParsedM3uEntry {
  name: string;
  group: string;
  logoUrl?: string;
  url: string;
  headers: Record<string, string>;
  drm?: ClearKeyConfig;
}

export function parseM3uPlaylist(content: string): ParsedM3uEntry[] {
  const lines = content.split(/\r?\n/);
  const entries: ParsedM3uEntry[] = [];

  let currentName = "";
  let currentGroup = "Cricket";
  let currentLogo: string | undefined;
  let currentHeaders: Record<string, string> = {};
  let currentDrm: ClearKeyConfig | undefined;
  let pendingInlineKid: string | undefined;
  let pendingInlineKey: string | undefined;

  const resetCurrent = (): void => {
    currentName = "";
    currentGroup = "Cricket";
    currentLogo = undefined;
    currentHeaders = {};
    currentDrm = undefined;
    pendingInlineKid = undefined;
    pendingInlineKey = undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (!line || line.startsWith("#EXTM3U")) continue;

    if (line.startsWith("#EXTINF:")) {
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const keyIdMatch = line.match(/(?:keyid|kid)="([^"]*)"/i);
      const keyMatch = line.match(/\bkey="([^"]*)"/i);

      if (groupMatch?.[1]) currentGroup = groupMatch[1].trim();
      if (logoMatch?.[1]) currentLogo = logoMatch[1].trim();
      if (keyIdMatch?.[1]) pendingInlineKid = keyIdMatch[1].trim();
      if (keyMatch?.[1]) pendingInlineKey = keyMatch[1].trim();

      const commaIdx = line.lastIndexOf(",");
      currentName = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : "Live Stream";
      continue;
    }

    if (line.startsWith("#EXTVLCOPT:")) {
      const opt = line.slice("#EXTVLCOPT:".length).trim();
      if (opt.toLowerCase().startsWith("http-user-agent=")) {
        currentHeaders["User-Agent"] = opt.slice("http-user-agent=".length).trim();
      } else if (opt.toLowerCase().startsWith("http-referrer=")) {
        currentHeaders["Referer"] = opt.slice("http-referrer=".length).trim();
      } else if (opt.toLowerCase().startsWith("http-origin=")) {
        currentHeaders["Origin"] = opt.slice("http-origin=".length).trim();
      }
      continue;
    }

    if (line.startsWith("#EXTHTTP:")) {
      const rawJson = line.slice("#EXTHTTP:".length).trim();
      try {
        const parsed = JSON.parse(rawJson) as Record<string, unknown>;
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string" && v.trim()) {
            currentHeaders[k] = v.trim();
          }
        }
      } catch {
        // ignore malformed EXTHTTP
      }
      continue;
    }

    if (line.startsWith("#KODIPROP:")) {
      const prop = line.slice("#KODIPROP:".length).trim();
      const eq = prop.indexOf("=");
      if (eq > 0) {
        const key = prop.slice(0, eq).trim().toLowerCase();
        const val = prop.slice(eq + 1).trim();
        if (key === "inputstream.adaptive.license_key") {
          const parsedDrm = parseClearKeySpec(val);
          if (parsedDrm) currentDrm = parsedDrm;
        } else if (key === "inputstream.adaptive.stream_headers") {
          const { headers } = parsePipeHeadersUrl(`https://placeholder|${val}`);
          Object.assign(currentHeaders, headers);
        }
      }
      continue;
    }

    if (line.startsWith("#")) continue;

    // Handle multi-line wrapped URLs if next line starts with `|` or `&`
    let fullUrlLine = line;
    while (i + 1 < lines.length) {
      const next = (lines[i + 1] ?? "").trim();
      if (next.startsWith("|") || next.startsWith("&")) {
        fullUrlLine += next;
        i++;
      } else {
        break;
      }
    }

    if (!/^https?:\/\//i.test(fullUrlLine)) {
      resetCurrent();
      continue;
    }

    const { url, headers: pipeHeaders } = parsePipeHeadersUrl(fullUrlLine);
    const mergedHeaders = { ...currentHeaders, ...pipeHeaders };

    if (!currentDrm && pendingInlineKid && pendingInlineKey) {
      currentDrm = parseClearKeySpec(`${pendingInlineKid}:${pendingInlineKey}`);
    }

    const entry: ParsedM3uEntry = {
      name: currentName || "Cricket Feed",
      group: currentGroup,
      url,
      headers: mergedHeaders,
    };
    if (currentLogo) entry.logoUrl = currentLogo;
    if (currentDrm) entry.drm = currentDrm;

    entries.push(entry);
    resetCurrent();
  }

  return entries;
}
