# Crease (`crease-api`)

> **Cloudflare Workers (`workerd`)-native Cricket-Only Live Fixtures, Canonical Squads, 24KB Manifest Inspection & Hardened 6-Scheme Edge Stream Proxy API**

![Version](https://img.shields.io/badge/version-0.0.0-14532D?style=flat-square)
![Runtime](https://img.shields.io/badge/runtime-Cloudflare_Workers_(workerd)-F38020?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Zero_Any-3178C6?style=flat-square)
![Spec](https://img.shields.io/badge/OpenAPI-3.1.0-0F172A?style=flat-square)
![Commits](https://img.shields.io/badge/Commits-Conventional_1.0.0-166534?style=flat-square)

**Crease** is a purpose-built, edge-native cricket aggregation and streaming platform engineered from the ground up for **Cloudflare Workers**. It federates 6 reverse-engineered CloudStream3 (`.cs3`) cryptographic pipelines in pure Web Standards (`Uint8Array` + `crypto.subtle`), filters and deduplicates fixtures through a collision-free cricket ontology, and delivers sub-millisecond reads via tiered L1/Cache API/KV caching with 2-minute Cron ingestion.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core Capabilities](#core-capabilities)
- [Cryptographic & CS3 Provider Matrix](#cryptographic--cs3-provider-matrix)
- [Cricket-First Domain Ontology](#cricket-first-domain-ontology)
- [API v1 & Developer Surfaces](#api-v1--developer-surfaces)
- [Security & Edge Hardening](#security--edge-hardening)
- [Local Development & Verification](#local-development--verification)
- [Cloudflare Workers Deployment](#cloudflare-workers-deployment)
- [Versioning, Conventional Commits & Changelog Governance](#versioning-conventional-commits--changelog-governance)
- [Repository Layout](#repository-layout)

---

## Architecture Overview

```text
                       ┌───────────────────────────────────────────────────────┐
                       │         Cloudflare Cron Trigger (*/2 * * * *)         │
                       │  Singleflight Firebase RC · 6 CS3 Adapters · Breaker  │
                       └──────────────────────────┬────────────────────────────┘
                                                  │
                                                  ▼
┌────────────────┐     ┌───────────────────────────────────────────────────────┐
│  Clients / UI  │────▶│          Crease Edge Worker (crease-edge)             │
│                │     │  Hono Router · Zod Validation · ETag/304 · OpenAPI    │
│ • /portal      │     │                                                       │
│ • /changelog   │     │  Tier 1: Isolate L1 LRU (0ms, singleflight)           │
│ • /docs        │     │  Tier 2: Cloudflare Cache API (caches.default)        │
│ • /api/v1/*    │     │  Tier 3: Cloudflare KV (CREASE_KV) + SWR waitUntil()  │
└────────────────┘     └──────────────┬─────────────────────────┬──────────────┘
                                      │                         │
                                      ▼                         ▼
                       ┌──────────────────────────┐  ┌─────────────────────────┐
                       │ Cricket-First Domain     │  │ Hardened Streaming Edge │
                       │ • Precision Classifier   │  │ • 24KB Manifest Prober  │
                       │ • Collision-Free Squads  │  │ • 6-Scheme Edge Proxy   │
                       │ • Canonical Dedup Engine │  │ • HLS/DASH Quality Trim │
                       │ • Typo-Tolerant Search   │  │ • SSRF & Redirect Guard │
                       └──────────────────────────┘  └─────────────────────────┘
```

### Runtime Guarantees
- **100% Web-Standards Edge Code (`src/`)**: Zero `node:*` imports, zero Node `Buffer`, zero `Bun.*`, zero `process.*`, zero `any`. Enforced automatically on every `npm run lint`.
- **Subrequest-Budgeted Execution**: Heavy provider fan-out runs on the scheduled 2-minute Cron Trigger; live HTTP requests read from precomputed edge snapshots with graceful zero-binding memory fallback during local development.
- **Compact Worker Bundle**: Bundles to ~**103 KiB gzipped** via `wrangler deploy --dry-run` (well within Cloudflare Workers free-tier limits).

---

## Core Capabilities

| Capability | Details |
| :--- | :--- |
| **Pure-Edge Crypto Engine** | Byte-for-byte port of all 6 Dalvik (`classes.dex`) CS3 decryption engines to `crypto.subtle` + `Uint8Array` (including pure-TS SXR3 sponge + 128-bit MAC and FIPS-197 AES-128-CBC NoPadding fallback), verified by deterministic Golden Vectors. |
| **Cricket-Only Precision** | Strict cricket classifier drops non-cricket sports (football, NBA, F1, UFC, tennis, WWE) while retaining international, franchise, women's, U19, A-Team, domestic fixtures, and 24/7 cricket networks. |
| **Canonical Deduplication** | Merges duplicate fixtures across providers using order-independent canonical match keys (`format + squadClass + sorted(teamA, teamB) + series + UTC date bucket`) and ranks streams deterministically by resolution, commentary language, protocol, and DRM status. |
| **24KB Manifest Inspector** | Bounded `ReadableStream` inspection (capped at 24KB) for HLS (`.m3u8`) and DASH (`.mpd`) detecting renditions, codecs, audio tracks, LL-HLS/LL-DASH, ClearKey/AES-128/SAMPLE-AES/CENC encryption, and player compatibility matrix. |
| **6-Scheme Edge Proxy** | Resolves `cricify://`, `sportzx://`, `playfy://`, `sktech://`, `playztv://`, `livxow://`, and `https://` streams with HLS/DASH quality filtering, signed CDN query token inheritance, and automatic fallback URLs. |
| **Live Feeds & Exports** | Dynamic XMLTV EPG (`/api/v1/epg.xml`), IPTV M3U8 playlist with `#KODIPROP` ClearKey directives (`/api/v1/playlist.m3u`), and bounded 55-second `TransformStream` SSE (`/api/v1/live/sse`). |
| **Integrated Developer Workbench** | Built-in Cricket Match Explorer & Manifest Inspector (`/portal`), Interactive OpenAPI 3.1 Runner (`/docs`), and live `CHANGELOG.md`-backed Release Ledger (`/changelog`). |

---

## Cryptographic & CS3 Provider Matrix

| Provider ID | Android Package | Custom Scheme | Native Cryptographic Pipeline (`src/crypto/`) |
| :--- | :--- | :--- | :--- |
| `cricify` | `com.cricfy.tv` | `cricify://` | 4-tier AES-128-CBC (Primary / Dex-Secondary / Legacy-Secondary) + `EnvelopeCrypto` |
| `sportzx` | `com.sportzxtv.app` | `sportzx://` | Pure-TS **SXR3** ChaCha20-variant sponge + 128-bit MAC (`decryptV3`, Dex & Legacy layouts) + AES-128-CBC fallbacks |
| `playfy` | `com.playfy.tv` | `playfy://` | Dalvik 32-bit **FNV-1a** (`0x811c9dc5`) Key/IV derivation + AES-128-CBC (PKCS#7 & NoPadding) + envelope unwrap |
| `sktech` | `com.live.sktechtv` | `sktech://` | 64-char hex header stripping + 256-byte **Lookup Table D** + **V23** byte-pair swap/reverse + AES cascade |
| `playztv` | `com.playz.tv` | `playztv://` | `libplayztv.so` byte reversal + adjacent byte-pair swap + substitution + AES-128-CBC |
| `livxow` | `com.livxow.tv` | `livxow://` | Multi-pass substitution + Base64url `pro/*.txt` resolution + AES-128-CBC |

---

## Cricket-First Domain Ontology

- **9 Match Formats**: `TEST`, `ODI`, `T20I`, `T20`, `T10`, `HUNDRED`, `LIST_A`, `FIRST_CLASS`, `OTHER`
- **9 Squad Classes**: `MENS`, `WOMENS`, `U19_MENS`, `U19_WOMENS`, `A_TEAM`, `LEGENDS`, `FRANCHISE`, `DOMESTIC`, `CLUB`
- **Collision-Free Canonical Squads**:
  - National squads never collide: `IND` (Men's) vs `IND-W` (Women's) vs `IND-U19` (U19 Men's) vs `IND-A` (India A)
  - Global sister franchises stay distinct: `MI` (IPL) vs `MI-W` (WPL) vs `MICT` (SA20) vs `MINY` (MLC) vs `MIE` (ILT20)
- **Typo-Tolerant Weighted Search**: Damerau-Levenshtein 1-edit matching (including adjacent character transpositions like `"Indai"` → `IND`) across matches, series, squads, and 24/7 cricket channels.

---

## API v1 & Developer Surfaces

All JSON API routes return a consistent `{ ok, data, meta, error }` envelope and stamp `X-Crease-Version` and `X-Crease-Edge-Cache` response headers.

### Interactive Web UI & Specifications
| Route | Format | Description |
| :--- | :--- | :--- |
| `GET /` · `GET /portal` | HTML | Live Cricket Match Explorer, 24/7 Channels, CS3 Providers & 24KB Manifest Inspector |
| `GET /changelog` | HTML | Interactive Release Ledger & Conventional Commits Explorer (fetched from `CHANGELOG.md`) |
| `GET /docs` | HTML | Interactive OpenAPI 3.1.0 Documentation & Live Request Runner |
| `GET /openapi.json` | JSON | Full OpenAPI 3.1.0 schema (`v0.0.0`) |
| `GET /changelog.md` | Markdown | Raw `CHANGELOG.md` single source of truth (`text/markdown; charset=utf-8`) |
| `GET /health` | JSON | Worker readiness, KV/Cache bindings, snapshot age, and provider circuit states |

### Versioned `/api/v1` Endpoints
| Group | Endpoints |
| :--- | :--- |
| **Matches** | `GET /api/v1/matches`, `/live`, `/upcoming`, `/featured`, `/:matchId`, `/:matchId/streams` |
| **Entities** | `GET /api/v1/series`, `/series/:seriesId`, `/teams`, `/teams/:teamId`, `/formats`, `/catalog` |
| **Schedule & EPG** | `GET /api/v1/schedule`, `/epg`, `/epg.xml` |
| **Channels & IPTV** | `GET /api/v1/channels`, `/channels/categories`, `/channels/:channelId`, `/broadcasters`, `/playlist.m3u` |
| **Streaming & Proxy** | `GET /api/v1/streams/inspect?url=...`, `/streams/:matchId`, `/proxy?url=...&quality=...` |
| **Realtime & System** | `GET /api/v1/live/sse`, `/search?q=...`, `/providers`, `/providers/:providerId`, `/stats`, `/diagnostics`, `/changelog` |

---

## Security & Edge Hardening

- **Private & Internal Network Blocking**: Rejects loopback, RFC1918 private networks, CGNAT (`100.64.0.0/10`), cloud metadata (`169.254.169.254`), IPv6 ULA/link-local/IPv4-mapped literals, decimal/hex/octal/shorthand IP bypasses, URL credentials, and non-HTTP(S) schemes across both manifest inspection and proxying.
- **Hop-by-Hop Redirect Validation**: Upstream `3xx` redirects are followed manually with every redirect target re-checked against the URL validator before fetching.
- **Credential Stripping**: Sensitive upstream headers (`Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`) are removed from all public JSON responses and proxy forwards are restricted to an explicit safe header allowlist.
- **Strict Input & Output Safety**: Query parameters are validated via Zod schemas and all built-in portal/docs/changelog views construct DOM elements safely via `createElement` and `textContent`.

---

## Local Development & Verification

```bash
# 1. Install dependencies
npm install

# 2. Start local preview server on port 3000 (serves exact Worker Hono app)
npm run dev

# 3. Or run inside local Cloudflare workerd via Wrangler
npm run dev:cf

# 4. Run full engineering verification gates
npm run build        # Verifies CHANGELOG.md sync + strict tsc --noEmit
npm run lint         # Zero any, zero Node/Bun/Buffer in src/, version & changelog lockstep
npm test             # Full Vitest suite (Golden Crypto Vectors, Ontology, SSRF, HTTP API, Changelog)
npm run cf:dry-run   # Verifies wrangler.jsonc bindings & Cloudflare Worker bundle size
```

---

## Cloudflare Workers Deployment

1. **Provision the KV namespace** for precomputed catalog snapshots:
   ```bash
   npx wrangler kv namespace create CREASE_KV
   npx wrangler kv namespace create CREASE_KV --preview
   ```
2. **Configure `wrangler.jsonc`**: Replace the placeholder `id` and `preview_id` under `kv_namespaces` with your namespace IDs.
3. **Verify bundle & deploy**:
   ```bash
   npm run build && npm run lint && npm test
   npx wrangler deploy
   ```

### Environment Variables (`wrangler.jsonc` / `.env.example`)
| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `production` | Deployment environment label (`development`, `staging`, `production`) |
| `SNAPSHOT_TTL_SECONDS` | `180` | Freshness window before background SWR refresh triggers |
| `STALE_WHILE_REVALIDATE_SECONDS` | `600` | Maximum stale window served while refreshing in `ctx.waitUntil()` |
| `PROVIDER_TIMEOUT_MS` | `4500` | Per-provider upstream fetch timeout (`AbortSignal.timeout`) |
| `ENABLE_UPSTREAM_FETCH` | `true` | Toggle live upstream CS3 provider fetches (`false` for offline contract tests) |
| `LOG_LEVEL` | `info` | Structured Worker log verbosity |

---

## Versioning, Conventional Commits & Changelog Governance

Crease follows **Semantic Versioning 2.0.0**, **Keep a Changelog 1.1.0**, and **Conventional Commits 1.0.0** with **zero-drift automated enforcement**:

- **`CHANGELOG.md` is the Single Source of Truth**: Every release note rendered at `/changelog`, `/api/v1/changelog`, and `/changelog.md` is synced directly from `/CHANGELOG.md`.
- **Automatic Lockstep Verification**: `npm run lint` fails automatically if `package.json`, `src/config/env.ts` (`APP_VERSION`), `CHANGELOG.md`, or `src/config/changelog-raw.ts` ever fall out of sync.

### Maintainer Workflow
```bash
# 1. Log new changes under `## [Unreleased]` in CHANGELOG.md using Conventional Commit bullets:
#    - `feat(domain):` **Title** — Concise technical description
#    - `fix(crypto):` **Title** — Root cause & fix summary
#    - `security(proxy):` **Title** — Hardening detail
#    - `perf(cache):` **Title** — Measured optimization

# 2. Sync CHANGELOG.md into the Cloudflare Worker bundle
npm run changelog:sync

# 3. Verify version & changelog parity
npm run release:check

# 4. Cut a new SemVer release (updates package.json, env.ts, promotes [Unreleased], and syncs bundle)
npm run release -- patch   # or: minor | major | 0.1.0 | --dry-run
```

### SemVer Progression
- **`0.0.0`** — Genesis foundation (Cloudflare-native rebuild, pure-edge crypto, cricket ontology, portal/docs/changelog)
- **`0.1.0`** — First public alpha (live KV/Cron telemetry tuning, expanded franchise calendars, scorecard hooks)
- **`1.0.0`** — Production stable `/api/v1` contract guarantee

---

## Repository Layout

```text
├── plan.md                      # Principal Engineering Blueprint & forensic audit delta
├── CHANGELOG.md                 # Single source of truth for release notes & /changelog
├── wrangler.jsonc               # Cloudflare Workers config (KV, Cron */2 * * * *, workerd)
├── src/
│   ├── index.ts                 # Worker entrypoint exporting fetch() & scheduled()
│   ├── config/                  # Typed CreaseEnv, APP_VERSION & synced changelog module
│   ├── crypto/                  # Pure Web Crypto / Uint8Array CS3 ciphers (6 providers + Envelope)
│   ├── providers/               # 6 CS3 provider adapters, Firebase RC singleflight, DRM, M3U8
│   ├── domain/                  # Cricket ontology, squads, series, classifier, dedup, search, changelog parser
│   ├── storage/                 # L1 LRU, circuit breaker, 3-tier KV/Cache API snapshot store
│   ├── ingestion/               # Catalog builder (XMLTV/M3U8) & Cron/SWR orchestrator
│   ├── streaming/               # SSRF guard, header redactor, 24KB manifest parser/prober, 6-scheme proxy
│   ├── http/                    # Hono app, envelope, OpenAPI 3.1.0 spec & /api/v1 route modules
│   └── ui/                      # Cricket Portal (/portal), Changelog (/changelog), API Docs (/docs)
├── scripts/
│   ├── dev-server.ts            # Local port-3000 preview wrapper around Worker fetch()
│   ├── lint.ts                  # Static edge-purity, zero-any & version/changelog parity gate
│   ├── sync-changelog.ts        # Zero-drift CHANGELOG.md -> Worker module generator
│   └── release.ts               # SemVer release bumper & [Unreleased] promoter
├── tests/                       # Vitest suites (Golden Crypto Vectors, Ontology, SSRF, HTTP API, Changelog)
└── cs3/                         # Archival reverse-engineered CS3 reference payloads (read-only)
```
