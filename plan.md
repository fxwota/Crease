# Crease (`crease-api`) — Principal Engineering Blueprint (`v0.0.0`)

> **Architectural Transformation**: From **Sportify v1.4.0** (Bun + Node-coupled, in-memory, multi-sport monolith) to **Crease v0.0.0** — a dedicated, Cricket-Only, Cloudflare Workers (`workerd`)-native Edge API preserving 100% of the reverse-engineered CS3 cryptographic and upstream extraction IP.

---

## 1. Brand Identity & Versioning Strategy

### Brand Decision: **Crease**
- **Display Name**: **Crease** (*Crease Cricket Edge API*)
- **NPM Package Name**: `crease-api`
- **Cloudflare Worker Name**: `crease-edge`
- **HTTP Server / Meta Header**: `X-Crease-Version: 0.0.0`, `X-Crease-Edge-Cache: HIT|MISS|STALE|BYPASS`
- **Rationale**: The *popping crease* is the single most recognizable spatial line in cricket across every format (Test, ODI, T20I, franchise leagues, and women's/youth internationals). The name is one crisp syllable, unmistakably cricket-native, free of generic "Sport/Live/Stream/Hub" clichés, and cleanly severs all ties to the legacy multi-sport *Sportify* brand.

### Fresh Versioning (`v0.0.0`) & Release Lifecycle
- **Reset Baseline**: `0.0.0` across `package.json`, `/openapi.json`, `/health`, response `meta.version`, and HTTP response headers.
- **Versioning Standard**: Strict **SemVer 2.0.0** paired with **Conventional Commits** (`feat:`, `fix:`, `perf:`, `refactor:`, `security:`, `test:`, `docs:`, `chore:`, `feat!:` for breaking changes).
- **Lifecycle Progression**:
  1. **`0.0.0` (Foundation Reset)**: Clean Cloudflare Workers architecture, Web-Standards crypto engine with 100% golden-vector parity, cricket-only domain ontology, SSRF-hardened 6-scheme proxy, `/api/v1` contract, and modern Cricket Portal & Docs.
  2. **`0.1.0` (Edge Alpha)**: Live Cloudflare Workers deployment with bound KV namespace, 2-minute Cron ingestion verified under real upstream traffic, and production telemetry baselines.
  3. **`0.2.0` – `0.x.0` (Pre-1.0 Hardening)**: Expanded franchise/domestic roster coverage, regional commentary feed detection refinements, and automated upstream canary alerts.
  4. **`1.0.0` (Stable GA)**: Frozen `/api/v1` JSON envelope and OpenAPI 3.1 contract with backwards-compatibility guarantees and formal deprecation windows.
- **Changelog Policy**: `CHANGELOG.md` follows *Keep a Changelog* format, starting fresh at `[0.0.0]` with zero legacy multi-sport release notes mixed into the active version stream.

---

## 2. Forensic Audit Findings & Architectural Delta

### A. Sacred IP Inventory (Preserved 100% Byte-for-Byte)
Every upstream extraction primitive audited in the legacy repository is carried forward verbatim into pure Web-Standards modules and locked down by deterministic Golden Vector tests before any legacy code is removed:

| Component | Preserved Sacred IP |
|---|---|
| **EnvelopeCrypto** | Plaintext bypass (`#EXTM3U`, `#EXTINF`, `#KODIPROP`, `{`, `[`, len < 79); slice layout `[0..10]` + IV `[10..34]` + `[34..len-54]` + Key `[len-54..len-10]` + `[len-10..]`; AES-256-CBC (32B key) / AES-128-CBC (16B key) PKCS#7. |
| **Cricify (`cricify`)** | Firebase project `963020218535` (`com.cricfy.tv`); keys `cric_api2`/`cric_api1`/`api_url`/`base_url`; fallback domains (`cftkhffmgf147.top`, `cfymarkscanjiostar80.top`, `cfyhljddgbkkufh82.top`); `/categories/live-events.txt`, `/cats.txt`, `/channels/{slug}.txt`; 3 M3U mirrors; AES-128-CBC cascade (Primary `3hHzxYAgSGI8/ham`, Dex Secondary `MqeYGCT4AYKoHKrT`, Legacy `1514925786399479`, EnvelopeCrypto); `cricify://{slug}`. |
| **Sportzx (`sportzx`)** | Firebase project `234785582029` (`com.sportzxtv.app`, SHA-1 `C506E5FE9C49CABD6A5AEAC643B7C3AA3C3FE9CF`); fallback domains (`world.playfy.stream`, `android.onlystream.stream`); `/events.txt`, `/events.json`, `/channels/{id}.json`; **SXR3** ChaCha20-variant sponge cipher + 128-bit MAC (both production dex tag-at-end counter=0 and legacy tag-before-ct counter=1 layouts) + 2 AES-128-CBC fallbacks; `sportzx://{id}`. |
| **PlayFy (`playfy`)** | Firebase project `239487160038` (`com.playfy.tv`, SHA-1 `31CD6939D1BEAE32D1B0EF2D9460B170116A1885`); fallback domains (`easypdfmaker.online`, `reliablewebcenter.online`); `PLAYFy/1.7 (Android)` UA; Dalvik 32-bit FNV-1a key/IV derivation (`0x811c9dc5` → `"BR4weRP=5A/Y&8%5"`, `0x811c832a` → `"Va+XYCKnkinUMDvk"`); AES-128-CBC PKCS#7 + NoPadding/zero-strip + `{"data":"..."}` envelope unwrap; `playfy://{id}`. |
| **SKTech (`sktech`)** | Firebase project `330162934410` (`com.live.sktechtv`); fallback domains (`kk001-a17.pages.dev`, `welalagaa.site`, `matkeritnagurorxbxb.store`); 64-char hex / `BA@G` prefix stripping; 256-byte Lookup Table D + reverse + AES-128-CBC; V23 byte-pair swap + reverse + AES-128-CBC; Fallback C/B/V25 cascade; nested `[{"event":...}]`/`[{"cat":...}]`/`[{"channel":...}]` unwrapping; `sktech://{path}`. |
| **PlayZTV (`playztv`)** | Firebase project `516859456626` (`com.playz.tv`); fallback domains (`pabbdyzone.shop`, `tourniquest.site`, `adsflw.xyz`, `playztv2828.store`); `libplayztv.so` reverse + adjacent byte-pair swap + AES-128-CBC; Primary substitution cipher + AES-128-CBC; fallback AES-128-CBC; `playztv://{path}`. |
| **LivXow (`livxow`)** | Firebase project `459539398637` (`com.livxow.tv`); fallback domains (`hsueuekaiwhhe.shop`, `welalagaa.site`, `sohaidoegeve2.shop`); `okhttp/4.9.2` UA; `pro/*.txt` Base64url resolution; Primary substitution cipher + AES-128-CBC + fallback; `livxow://{path}`. |
| **Stream Intelligence & Proxy** | TokenApiResolver (`embed`/`json`/`sp`/`html`/`yt`/`ls` + `ip_api`), ClearKey hex/UUID/Base64/Base64URL + W3C license POST, M3U `#KODIPROP`/`#EXTVLCOPT`/`#EXTHTTP`/pipe headers, non-self-sabotaging candidate probing, 24KB HLS/DASH inspection, playback compatibility matrix, 6-scheme proxy + HLS/DASH quality filter + signed CDN query token inheritance. |

### B. Forensic Audit Delta: Legacy Sportify v1.4.0 vs. Crease v0.0.0

| Dimension | Legacy Sportify v1.4.0 (Defects) | Crease v0.0.0 (Cloudflare-Native Redesign) |
|---|---|---|
| **Runtime Coupling** | `Bun.file()`, `import.meta.dir`, `node:path`, `node:crypto`, Node `Buffer`, `process.memoryUsage()`, `process.uptime()`. Crashes immediately on `workerd`. | 100% Web Standards (`fetch`, `Request`, `Response`, `crypto.subtle`, `Uint8Array`, `TextEncoder`, `TransformStream`, `AbortSignal.timeout`). Zero `Bun.*`, zero `node:*`, zero `Buffer` in `src/`. |
| **Background Timers** | Global `setInterval` in `AggregatorService` constructor + unbounded SSE `setInterval`. Illegal in Worker global scope; leaks across isolate hibernation. | Cloudflare Cron Trigger `scheduled(controller, env, ctx)` for ingestion; `ctx.waitUntil()` SWR on cache miss; bounded `TransformStream` SSE with `AbortSignal` cleanup and `retry:` directive. |
| **State & Caching** | Process-local `Map` singletons + 50MB binary media segment micro-cache (causes 128MB isolate OOM and zero cross-PoP sharing). | 3-Tier Edge Caching: L1 bounded isolate LRU (5–15s) + L2 Cloudflare Cache API (`caches.default`) + L3 Cloudflare KV canonical snapshots. Binary segments stream directly without buffering in JS heap. |
| **Subrequest Budget** | User HTTP requests trigger live 6-provider fan-out (30–60+ upstream subrequests), breaching Cloudflare's 50-subrequest limit. | Normal reads (`GET /api/v1/*`) perform **0–1 subrequests** (L1/Cache API/KV read). Cron ingestion operates under its own Worker invocation budget with singleflight Firebase RC caching. |
| **Code Architecture** | Two monolithic God files (`catalog/normalizer.ts` 2,095 lines, `aggregator.service.ts` 2,039 lines); duplicated provider helpers; inconsistent route envelopes. | Strict layered modular architecture (`domain/`, `crypto/`, `providers/`, `streaming/`, `storage/`, `ingestion/`, `http/`, `ui/`), each file cohesive and focused (<400 lines). |
| **Domain Focus** | Multi-sport ontology bloated with Football, NBA, NFL, NHL, F1, UFC, WWE, Tennis, Snooker, Darts, Cycling. | Pure **Cricket-First** ontology: 9 match formats, 9 squad classes, collision-free squad graph (`IND` vs `IND-W` vs `IND-U19` vs `IND-A`, `MI` vs `MI-W` vs `MICT` vs `MINY` vs `MIE`), precision cricket filter + 24/7 cricket channel rules. |
| **Security & SSRF** | `isSafeUpstreamUrl()` had an ephemeral-port localhost bypass (`port >= 10000`); allowed decimal/hex/octal IPs & IPv4-mapped IPv6; `redirect: "follow"` allowed 3xx SSRF bypass; `Cookie` leaked in public JSON. | Airtight SSRF validator blocking loopback, RFC1918, CGNAT, link-local, metadata, IPv6 ULA/mapped, alternate IP encodings; `redirect: "manual"` with per-hop SSRF validation (max 5 hops); strict redaction of `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`. |
| **API Contract** | Mixed `/api/*` and `/api/v1/*` paths; ad-hoc `{ success, version, ... }` envelopes; unvalidated query parameters. | Single clean `/api/v1/...` contract with unified `{ ok, data, meta, error }` envelope, Zod query validation, weak `ETag` + `304 Not Modified`, and OpenAPI 3.1. |

---

## 3. Tech Stack Evaluation & Decisions

| Layer | Choice | Rationale & `workerd` Compatibility |
|---|---|---|
| **Web Framework** | **Hono (`hono`)** | Native Web Fetch API (`Request`/`Response`), ~14KB gzipped, first-class Cloudflare Workers bindings typing (`Hono<{ Bindings: Env }>`), built-in CORS/ETag/Middleware ergonomics. |
| **Runtime Validation** | **Zod (`zod`)** | Strict schema validation for query params, env bindings, upstream payload guards, and SSRF URL inputs; zero Node dependencies. |
| **Cryptography** | **Web Crypto (`crypto.subtle`) + Pure-TS `Uint8Array`** | Zero `node:crypto`, zero `Buffer`. AES-128/256-CBC PKCS#7 uses `crypto.subtle.decrypt`; a compact (~110-line) pure-TS AES-128 block decryptor handles PlayFy's Dalvik `NoPadding` fallback where Web Crypto strictly enforces PKCS#7; Sportzx SXR3 sponge + PlayFy FNV-1a + SKTech/PlayZTV/LivXow transforms run directly on `Uint8Array`. |
| **TypeScript** | **`typescript` (Strict Mode)** | Enforces `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `isolatedModules: true`, `noImplicitOverride: true`, `@cloudflare/workers-types`. |
| **Linting** | **ESLint v9 Flat Config + `typescript-eslint`** | Enforces zero `any`, explicit boundary hygiene, unused variable bans, and zero `node:*` imports inside `src/`. |
| **Testing** | **Vitest (`vitest`)** | Fast TypeScript-native test runner supporting pure unit tests, Golden Crypto vectors, SSRF security suites, and full `worker.fetch()` / `worker.scheduled()` integration tests against mocked KV/Cache bindings. |
| **Edge Bundling & Deploy** | **Wrangler (`wrangler`)** | Official Cloudflare Workers CLI for `wrangler.jsonc` validation, `wrangler deploy --dry-run` bundle size & `workerd` compatibility verification, and local dev server (`wrangler dev --port 3000`). |

---

## 4. Cloudflare Edge Architecture & Subrequest Budget Plan

### A. Decoupled Read / Write Data Flow
```
                     [Cloudflare Cron Trigger: */2 * * * *]
                                       │
                                       ▼
                        scheduled(controller, env, ctx)
                     ┌─────────────────────────────────┐
                     │  Singleflight Firebase RC Cache │ (6h TTL in KV + L1)
                     │  6 CS3 Provider Adapters        │ (bounded timeout + circuit breaker)
                     │  Cricket Classifier & Dedup     │ (canonical squads, series, streams)
                     └─────────────────┬───────────────┘
                                       │ writes atomic snapshot
                                       ▼
                     ┌─────────────────────────────────┐
                     │   L3: KV Snapshot Store         │ key: "crease:snapshot:v1"
                     │   (fallback: in-memory store)   │
                     └─────────────────┬───────────────┘
                                       │
  Client Request ──► Worker fetch() ──►├─► L1 Isolate LRU (10s TTL, max 64 entries)
  GET /api/v1/*                        ├─► L2 Cache API (caches.default, 30s SWR)
                                       ├─► L3 KV Read (1 subrequest; 0 upstream hits!)
                                       └─► ctx.waitUntil() background SWR if stale
```

### B. Subrequest Budget Math (Staying Safely Below 50 Subrequests/Invocation)
- **Standard API Read (`GET /api/v1/matches`, `/series`, `/teams`, `/channels`, `/epg.xml`, `/playlist.m3u`, `/search`)**:
  - Warm L1 hit: **0 subrequests** (< 2 ms CPU).
  - Warm L2 Cache API hit: **0 external subrequests** (< 5 ms).
  - Cold isolate L3 KV hit: **1 KV read** (0 external fetches).
  - Cold start with stale snapshot: returns stale immediately + triggers `ctx.waitUntil()` refresh (coalesced via singleflight lock so concurrent requests never stampede).
- **Scheduled Ingestion (`scheduled()` every 2 minutes)**:
  - Firebase Remote Config: cached for 6 hours in KV + L1 → **0 subrequests** on 99% of runs (max 6 subrequests on cold refresh).
  - 6 CS3 Providers: each uses domain failover with `AbortSignal.timeout(4500)` and bounded candidate probing (max 3–4 requests per provider) → **~12–24 subrequests total**, comfortably inside the 50-subrequest Cloudflare budget.
- **Stream Inspect / Proxy (`/api/v1/streams/inspect`, `/api/v1/proxy`)**:
  - 1 upstream fetch (plus max 1–2 custom-scheme resolution hops + bounded redirect validation up to 5 hops) → **1–7 subrequests**, strictly budgeted.

### C. Zero-Binding Graceful Degradation
When deployed or tested without `CREASE_KV` bound (e.g., local preview, unit tests, CI dry-run):
- `SnapshotStore` transparently falls back to a bounded in-isolate store (`MemorySnapshotBackend`) + Cache API (when `caches.default` exists).
- If all 6 upstream providers are unreachable in an offline/sandboxed environment, the ingestion orchestrator preserves the last known good snapshot (or activates a clean, clearly tagged empty/degraded state — never crashing the Worker, with explicit per-provider error telemetry).

### D. Isolate-Safe Circuit Breakers & Telemetry
- Per-provider state (`CLOSED` → `OPEN` after 3 consecutive failures for 60s → `HALF_OPEN` single probe) is stored in L1 isolate memory and opportunistically mirrored into the single KV snapshot payload written by `scheduled()`, avoiding per-request KV write amplification.

### E. Edge-Safe SSE (`GET /api/v1/live/sse`)
- Built with Web Standard `TransformStream` + `TextEncoder`.
- Emits immediate `retry: 5000` directive and initial `snapshot` event.
- Sends periodic `: keep-alive` comments every 15s using a scoped timer explicitly cleared on `c.req.raw.signal.addEventListener("abort", ...)` AND upon reaching a bounded max stream lifetime (55 seconds, preventing hung Worker connections and prompting clean browser `EventSource` reconnects via `retry:`).

---

## 5. Cricket-First Domain Ontology

### A. Core Enumerations
- **Match Formats (`MatchFormat`)**:
  `TEST` | `ODI` | `T20I` | `T10` | `HUNDRED` | `T20` | `LIST_A` | `FIRST_CLASS` | `OTHER`
- **Squad Classes (`SquadClass`)**:
  `MENS` | `WOMENS` | `U19_MENS` | `U19_WOMENS` | `A_TEAM` | `LEGENDS` | `FRANCHISE` | `DOMESTIC` | `CLUB`
- **Match Lifecycle Phases (`MatchPhase`)**:
  `upcoming` | `pre_match` | `live` | `break` | `completed` | `abandoned` | `unknown`
- **Event Kind (`CricketEventKind`)**:
  `match` | `tournament_channel` | `highlight_or_show`
- **Stream Protocols & Encryption**:
  Protocols: `hls` | `dash` | `mp4` | `ts` | `unknown`
  Encryption: `NONE` | `CLEARKEY` | `AES-128` | `SAMPLE-AES` | `CENC` | `UNKNOWN`

### B. Collision-Free Canonical Squad & Team Graph
Every team identity is scoped by **canonical ID + squad class + franchise/board context**, preventing cross-squad collisions:
- **International Squads**:
  - `IND` (India Men) ≠ `IND-W` (India Women) ≠ `IND-U19` (India U19 Men) ≠ `IND-U19W` (India U19 Women) ≠ `IND-A` (India A) ≠ `IND-L` (India Legends/Champions)
  - Full coverage of all 12 ICC Full Members (`IND`, `AUS`, `ENG`, `PAK`, `NZ`, `SA`, `SL`, `BAN`, `WI`, `AFG`, `IRE`, `ZIM`) plus major Associate nations (`NED`, `SCO`, `NAM`, `NEP`, `UAE`, `USA`, `OMA`, `CAN`, `PNG`, `UGA`, `HK`, `KUW`, `BHR`, `MAS`, `ITA`, `JER`, `BER`, `KEN`) with automatic `-W`, `-U19`, `-U19W`, `-A`, `-L` squad disambiguation.
- **Franchise Squad Disambiguation**:
  - `MI` (Mumbai Indians, IPL) ≠ `MI-W` (Mumbai Indians Women, WPL) ≠ `MICT` (MI Cape Town, SA20) ≠ `MINY` (MI New York, MLC) ≠ `MIE` (MI Emirates, ILT20).
  - Full canonical rosters for **IPL**, **WPL**, **BBL**, **WBBL**, **PSL**, **CPL**, **WCPL**, **SA20**, **ILT20**, **MLC**, **BPL**, **LPL**, **The Hundred (Men & Women)**, **T20 Blast**, **Super Smash**, **NPL**, **Abu Dhabi T10**, **Legends League / WCL**, plus domestic boards (Ranji, Sheffield Shield, County Championship, Plunket Shield, Marsh Cup).
- **Unicode Normalization**: NFD decomposition + diacritic stripping + punctuation folding ensures noisy titles (e.g., `India Women vs Australia-W | 3rd ODI`) resolve deterministically.

### C. Precision Cricket-Only Classifier & 24/7 Channel Rules
1. **Strict Non-Cricket Rejection**: Immediately drops Football/Soccer (EPL, UCL, La Liga, Serie A, Bundesliga, MLS, FIFA, UEFA, Real Madrid, Barcelona, Man Utd, Arsenal, etc.), Basketball (NBA, WNBA, EuroLeague), American Football (NFL, NCAA), Ice Hockey (NHL), Motorsport (F1, MotoGP, NASCAR), Combat Sports (UFC, MMA, WWE, AEW, Boxing), Tennis (ATP, WTA, Wimbledon, US Open), Golf, Snooker, Darts, Cycling, Rugby, Baseball (MLB), and Volleyball.
2. **Positive Cricket Verification**: Retains events matching any of:
   - Explicit cricket sport/category metadata (`cricket`, `ipl`, `wpl`, `bbl`, `psl`, `icc`, `t20`, `odi`, `test match`, `ranji`, `ashes`, `super smash`, `the hundred`, `t10`).
   - Two resolved canonical cricket teams/squads (or 1 cricket squad + cricket tournament/format signal).
   - Recognized cricket broadcasters or tournament keywords (`Willow`, `Astro Cricket`, `Sky Sports Cricket`, `Star Sports Cricket`, `Fox Cricket`, `Ten Cricket`, `PTV Sports` airing cricket, `A Sports`, `T Sports`).
3. **24/7 Channels Filtering**:
   - Retains dedicated 24/7 cricket channels (Willow, Willow Xtra, Sky Sports Cricket, Fox Cricket, Astro Cricket, Star Sports 1/2/Hindi/Tamil/Telugu/Kannada, Sony Sports Ten 1/2/3/5, Ten Cricket, PTV Sports, A Sports, Geo Super, T Sports, Gazi TV, SuperSport Cricket, TNT Sports / Prime / FanCode cricket feeds) while excluding non-cricket specialty channels (e.g., Sky Sports F1, NFL Network, NBA TV, Golf Channel, WWE Network, MUTV, LFCTV).

### D. Order-Independent Canonical Fixture Deduplication & Stream Ranking
- **Canonical Key**: `SHA-256(format | squadClass | sorted([teamA.id, teamB.id]) | seriesId | dateBucketUTC)` → 16-char hex ID (`crk_<hash>`).
- **Order-Independence**: `"IND vs AUS 2nd T20I"` (Cricify) and `"Australia v India - T20"` (Sportzx) produce the identical canonical `matchId` and merge into one `CricketMatch` with `providerCount: 2`, combined stream list, consensus `phase` (live beats upcoming when ≥1 active stream exists), and merged metadata.
- **Deterministic Stream Ranking**:
  Scores streams by: `(1) Protocol & Browser Compatibility` (+35 HLS unencrypted, +25 DASH unencrypted/ClearKey, +10 CENC) + `(2) Quality Tier` (UHD/4K +30, 1080p/FHD +24, 720p/HD +16, 480p +8, 360p +4) + `(3) Commentary / Feed Tier` (primary `en`/`hi` + regional `ta`/`te`/`kn`/`bn`/`mr`/`bho`/`gu`/`ml`/`pa` + special feeds `dugout`, `stump-cam`, `tactical`, `hero-cam`, `insider`) + `(4) Provider Health & Reliability Score` (0–20) + `(5) Verified Live Manifest Bonus` (+15 when probed reachable).

---

## 6. Target Modular Directory Architecture

```text
/
├── plan.md                         # This architectural blueprint
├── wrangler.jsonc                  # Cloudflare Workers config (KV, Cron, compatibility)
├── package.json                    # name: "crease-api", version: "0.0.0"
├── tsconfig.json                   # Strict TS + @cloudflare/workers-types
├── eslint.config.mjs               # Strict ESLint v9 flat config (zero node:* in src/)
├── vitest.config.ts                # Vitest test runner config
├── .env.example                    # Documented runtime env variables (no secrets)
├── CHANGELOG.md                    # Fresh v0.0.0 Keep-a-Changelog ledger
├── README.md                       # Complete Crease developer & deployment guide
├── src/
│   ├── index.ts                    # Cloudflare Worker export { fetch, scheduled }
│   ├── dev-server.ts               # Lightweight local dev adapter (port 3000) for container preview
│   ├── config/
│   │   └── env.ts                  # Typed Cloudflare Env bindings & constants (VERSION = "0.0.0")
│   ├── crypto/                     # Pure Web Standards (Uint8Array + crypto.subtle)
│   │   ├── bytes.ts                # Base64, Base64URL, Hex, UTF-8, SHA-256 helpers
│   │   ├── aes-cbc.ts              # Web Crypto AES-128/256-CBC + pure-TS AES-128 NoPadding
│   │   ├── envelope.ts             # EnvelopeCrypto (AES-256/128-CBC slice unwrapping)
│   │   ├── cricify.ts              # Cricify 4-tier decryption cascade
│   │   ├── sportzx.ts              # Sportzx SXR3 sponge cipher + MAC + AES fallbacks
│   │   ├── playfy.ts               # PlayFy Dalvik FNV-1a key/IV + AES-CBC NoPadding/PKCS7
│   │   ├── sktech.ts               # SKTech Lookup Table D + V23 + 64-hex strip + cascade
│   │   ├── playztv.ts              # PlayZTV reverse/swap + substitution + cascade
│   │   ├── livxow.ts               # LivXow substitution + cascade
│   │   └── index.ts                # Barrel exports
│   ├── domain/                     # Pure cricket logic (ZERO http/cloudflare/provider imports)
│   │   ├── types.ts                # Canonical CricketMatch, Series, Squad, Stream, Channel types
│   │   ├── schemas.ts              # Zod query & payload validation schemas
│   │   ├── teams.ts                # Collision-free canonical cricket squad graph
│   │   ├── series.ts               # ICC, ACC, franchise & bilateral competition registry
│   │   ├── classifier.ts           # Precision cricket-only filter & 24/7 cricket channel rules
│   │   ├── parser.ts               # Diacritic folding, format/phase/stage/entity extraction
│   │   ├── deduplicator.ts         # Order-independent canonical fixture deduplication
│   │   ├── stream-ranker.ts        # Language/feed detection, compatibility & quality ranker
│   │   └── search.ts               # Weighted, 1-edit typo-tolerant cricket search engine
│   ├── providers/                  # CS3 upstream adapters (all 6 preserved byte-for-byte)
│   │   ├── types.ts                # ProviderAdapter interface & raw payload types
│   │   ├── firebase-rc.ts          # Singleflight Firebase Remote Config client + KV/L1 cache
│   │   ├── base.ts                 # Domain failover, date parser, sanitizers, nested unwrap
│   │   ├── drm.ts                  # ClearKey hex/UUID/Base64/W3C JSON + MPD KID resolver
│   │   ├── m3u.ts                  # M3U8 parser (#KODIPROP, #EXTVLCOPT, #EXTHTTP, pipe hdrs)
│   │   ├── token-api.ts            # TokenApiResolver (embed/json/sp/html/yt/ls + ip_api)
│   │   ├── cricify.ts              # Cricify CS3 adapter
│   │   ├── sportzx.ts              # Sportzx CS3 adapter
│   │   ├── playfy.ts               # PlayFy CS3 adapter
│   │   ├── sktech.ts               # SKTech CS3 adapter
│   │   ├── playztv.ts              # PlayZTV CS3 adapter
│   │   ├── livxow.ts               # LivXow CS3 adapter
│   │   └── registry.ts             # 6-provider registry & metadata
│   ├── streaming/                  # SSRF, Manifest Inspection & 6-Scheme Edge Proxy
│   │   ├── ssrf.ts                 # Airtight URL/IP validator + manual-redirect safeFetch
│   │   ├── headers.ts              # Strict credential redaction & signed CDN token inheritance
│   │   ├── manifest-parser.ts      # 24KB HLS/DASH parser (renditions, audio, encryption, LL)
│   │   ├── prober.ts               # Bounded-concurrency canary prober & playback matrix
│   │   └── proxy.ts                # 6-scheme resolver, HLS/DASH quality filter, streaming proxy
│   ├── storage/                    # Cloudflare Edge Storage & Caching
│   │   ├── l1-cache.ts             # Bounded isolate LRU + singleflight coalescer
│   │   ├── circuit-breaker.ts      # Isolate-safe per-provider circuit breaker
│   │   └── snapshot-store.ts       # L1 + Cache API (caches.default) + KV + memory fallback
│   ├── ingestion/                  # Scheduled Ingestion & Catalog Builder
│   │   ├── catalog-builder.ts      # Raw provider items -> CricketCatalogSnapshot + O(1) indexes
│   │   └── orchestrator.ts         # Cron/SWR coordinator with subrequest & timeout budgets
│   ├── http/                       # Hono /api/v1 App, Middleware & Routes
│   │   ├── envelope.ts             # Unified { ok, data, meta, error } helpers & ETag/304
│   │   ├── app.ts                  # Hono application factory & error/CORS/security headers
│   │   ├── openapi.ts              # OpenAPI 3.1.0 specification (version 0.0.0)
│   │   └── routes/
│   │       ├── matches.ts          # /api/v1/matches (/live, /upcoming, /featured, /:id, /:id/streams)
│   │       ├── entities.ts         # /api/v1/series, /teams, /formats, /catalog
│   │       ├── schedule.ts         # /api/v1/schedule, /epg, /epg.xml
│   │       ├── channels.ts         # /api/v1/channels, /broadcasters, /playlist.m3u
│   │       ├── streams.ts          # /api/v1/streams/:matchId, /streams/inspect, /proxy
│   │       ├── live-sse.ts         # /api/v1/live/sse (TransformStream + heartbeat + bounded TTL)
│   │       └── system.ts           # /api/v1/search, /providers, /diagnostics, /stats, /health
│   └── ui/                         # Zero-FS Cloudflare-bundleable Cricket Portal & Docs UI
│       ├── portal.ts               # Modern Cricket Match Explorer & Stream Bench HTML
│       └── docs.ts                 # Interactive Crease API v0.0.0 Documentation HTML
└── tests/
    ├── crypto/golden-vectors.test.ts     # All 6 CS3 ciphers + EnvelopeCrypto golden vectors
    ├── domain/cricket-ontology.test.ts   # Classifier, squad disambiguation, dedup, ranking, search
    ├── streaming/ssrf-and-manifest.test.ts # SSRF bypass suite, 3xx redirects, 24KB manifest, redaction
    └── http/worker-api.test.ts           # End-to-end Worker fetch()/scheduled() API contract tests
```

### Layer Dependency Rules (Enforced Strictly)
1. `src/domain/*` imports **only** `zod` and `src/crypto/bytes.ts` (for deterministic SHA-256 fixture IDs). Never imports `http`, `providers`, `storage`, or Cloudflare types.
2. `src/crypto/*` imports **zero** external packages — pure Web Standards only.
3. `src/providers/*` depends on `src/crypto/*`, `src/streaming/ssrf.ts`, and `src/storage/l1-cache.ts`.
4. `src/http/*` depends on `src/ingestion/*`, `src/streaming/*`, `src/domain/*`, and `src/ui/*`.

---

## 7. Complete `/api/v1/...` API Contract

### Unified Response Envelope
Every JSON endpoint returns:
```json
{
  "ok": true,
  "data": {},
  "meta": {
    "version": "0.0.0",
    "timestamp": "2026-04-12T14:00:00.000Z",
    "requestId": "req_...",
    "cache": "HIT",
    "etag": "W/\"...\"",
    "pagination": { "page": 1, "limit": 50, "total": 12, "totalPages": 1 }
  },
  "error": null
}
```
Error responses return `{ ok: false, data: null, meta: { version, timestamp, requestId }, error: { code, message, details? } }` with structured codes (`INVALID_QUERY`, `MATCH_NOT_FOUND`, `SERIES_NOT_FOUND`, `TEAM_NOT_FOUND`, `CHANNEL_NOT_FOUND`, `PROVIDER_NOT_FOUND`, `SSRF_BLOCKED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL_ERROR`).

### Complete Endpoint Matrix
| Endpoint | Method | Purpose & Parameters |
|---|---|---|
| `/health` | `GET` | Worker readiness, `version: "0.0.0"`, KV/Cache binding status, provider circuit states, snapshot age. |
| `/openapi.json` | `GET` | Full OpenAPI 3.1.0 specification for Crease `v0.0.0`. |
| `/docs` | `GET` | Interactive Crease Cricket API documentation & endpoint explorer. |
| `/`, `/portal` | `GET` | Live Cricket Match Explorer, Squad/Format filters, and Stream Inspector / Test Bench UI. |
| `/api/v1/matches` | `GET` | Filterable, sortable, paginated cricket fixtures (`phase`, `format`, `squadClass`, `series`, `team`, `provider`, `language`, `drm`, `featured`, `q`, `sort`, `page`, `limit`) + `ETag`/`304`. |
| `/api/v1/matches/live` | `GET` | Currently live cricket matches across all 6 CS3 providers. |
| `/api/v1/matches/upcoming` | `GET` | Scheduled upcoming cricket fixtures sorted chronologically. |
| `/api/v1/matches/featured` | `GET` | Marquee & high-priority cricket fixtures (ICC finals, rivalries, multi-provider live matches). |
| `/api/v1/matches/:matchId` | `GET` | O(1) canonical match lookup with full squad metadata, series, and ranked streams. |
| `/api/v1/matches/:matchId/streams` | `GET` | Resolved, ranked stream feeds for a match (`protocol`, `quality`, `language`, `provider`, `probe`). |
| `/api/v1/series` | `GET` | Active cricket series & tournaments (`format`, `active`, `q`). |
| `/api/v1/series/:seriesId` | `GET` | Series profile, participating squads, and fixtures. |
| `/api/v1/teams` | `GET` | Canonical cricket squads (`squadClass`, `series`, `active`, `q`, `limit`). |
| `/api/v1/teams/:teamId` | `GET` | Squad profile (`IND`, `IND-W`, `MI`, `MICT`, etc.), aliases, and fixtures. |
| `/api/v1/formats` | `GET` | Cricket format breakdown (`TEST`, `ODI`, `T20I`, `T20`, `T10`, `HUNDRED`, `LIST_A`, `FIRST_CLASS`) with live/upcoming counts. |
| `/api/v1/catalog` | `GET` | Unified cricket catalog snapshot summary with ETag/304 support. |
| `/api/v1/schedule`, `/api/v1/epg` | `GET` | Chronological cricket schedule grouped by `liveNow`, `startingSoon`, and UTC date (`date`, `format`). |
| `/api/v1/epg.xml` | `GET` | Standards-compliant XMLTV EPG for cricket fixtures and 24/7 cricket channels (`application/xml`). |
| `/api/v1/channels` | `GET` | 24/7 cricket channels (`category`, `provider`, `q`, `page`, `limit`). |
| `/api/v1/channels/categories` | `GET` | Normalized cricket channel categories with HD/total counts. |
| `/api/v1/channels/:channelId` | `GET` | Channel detail with resolved playable streams and proxy URLs. |
| `/api/v1/broadcasters` | `GET` | Cricket broadcast networks (Willow, Star Sports, Sky Sports Cricket, Fox Cricket, etc.) with coverage counts. |
| `/api/v1/streams/:matchId` | `GET` | Alias for `/api/v1/matches/:matchId/streams` with canary probe & playback compatibility matrix. |
| `/api/v1/streams/inspect` | `GET` | Deep 24KB HLS/DASH manifest inspector (`url`, `referer`, `userAgent`) returning renditions, audio tracks, encryption, ClearKey KIDs, LL-HLS/DASH flags, and compatibility matrix. |
| `/api/v1/proxy` | `GET`, `OPTIONS` | Hardened 6-scheme (`cricify://`, `sportzx://`, `playfy://`, `sktech://`, `playztv://`, `livxow://`) & HTTPS HLS/DASH reverse proxy with quality variant filtering and signed CDN token inheritance. |
| `/api/v1/playlist.m3u` | `GET` | Dynamic IPTV M3U8 playlist for cricket matches & 24/7 cricket channels with `#KODIPROP` ClearKey directives (`format`, `proxy`). |
| `/api/v1/live/sse` | `GET` | Edge-safe `TransformStream` SSE feed delivering snapshot updates, heartbeats, and bounded 55s lifecycle with `retry: 5000`. |
| `/api/v1/search` | `GET` | Weighted, 1-edit typo-tolerant cricket search across matches, series, squads, and channels (`q`, `limit`). |
| `/api/v1/providers` | `GET` | All 6 CS3 providers with cryptographic pipeline descriptors, circuit states, and cricket extraction counts. |
| `/api/v1/providers/:providerId` | `GET` | Detailed single-provider status and contributed fixtures/channels. |
| `/api/v1/diagnostics` | `GET` | Extraction coverage, cricket classification ratio, deduplication efficiency, and provider telemetry. |
| `/api/v1/stats` | `GET` | Platform-wide cricket metrics (formats, squad classes, protocols, DRM types, cache hit ratios). |

---

## 8. Security, SSRF & Reliability Hardening Blueprint

1. **Airtight SSRF Validator (`src/streaming/ssrf.ts`)**:
   - Allows **strictly** `http:` and `https:` schemes (rejects `file:`, `ftp:`, `gopher:`, `data:`, `javascript:`, `dict:`, etc.).
   - Rejects userinfo credentials embedded in URLs (`https://user:pass@host`).
   - Blocks hostnames: `localhost`, `*.localhost`, `*.local`, `*.internal`, `metadata.google.internal`, `metadata`, `instance-data`, `*.arpa`.
   - Normalizes and blocks **alternate IPv4 encodings**: pure decimal (`2130706433`), hexadecimal (`0x7f000001`), octal (`0177.0.0.1`), and shorthand IPv4 (`127.1`).
   - Blocks reserved IPv4 CIDR ranges: `0.0.0.0/8`, `10.0.0.0/8` (RFC1918), `100.64.0.0/10` (CGNAT), `127.0.0.0/8` (loopback), `169.254.0.0/16` (link-local & cloud metadata `169.254.169.254`), `172.16.0.0/12` (RFC1918), `192.0.0.0/24`, `192.168.0.0/16` (RFC1918), `198.18.0.0/15`, `224.0.0.0/4` (multicast), `240.0.0.0/4` (reserved).
   - Blocks reserved IPv6 ranges: `::`, `::1`, `fc00::/7` (ULA), `fe80::/10` (link-local), `ff00::/8` (multicast), and **IPv4-mapped IPv6** (`::ffff:127.0.0.1`, `::ffff:7f00:1`, `::ffff:169.254.169.254`).
   - **Zero test-port loopholes**: No localhost port exemptions anywhere in production SSRF validation.
2. **Redirect-Hop SSRF Protection**:
   - All proxy and manifest inspector fetches execute with `redirect: "manual"` in a bounded loop (max 5 redirects). Every `301`/`302`/`303`/`307`/`308` `Location` target is resolved and re-validated through `assertSafeUpstreamUrl()` before following.
3. **Credential Redaction & Header Hygiene (`src/streaming/headers.ts`)**:
   - Strict denylist on all public JSON responses and proxy outbound/inbound forwarding: `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, `X-Auth-Token`. Public API JSON redacts or strips sensitive header values and never exposes raw cookies or bearer tokens.
   - Proxy forwards only an explicit allowlist of playback-required headers (`User-Agent`, `Referer`, `Origin`, `Range`, `Accept`, `Accept-Language`).
   - Signed CDN query tokens (`hdnts`, `hdnea`, `token`, `access_token`, `sig`, `signature`, `hmac`, `auth`, `policy`, `key-pair-id`, `expires`, `exp`, `st`, `e`, `md5`, `hash`, `wmsauthsign`, `wmsAuthSign`) are inherited across child HLS/DASH playlists and media segments when the child URL omits them.
4. **Input Validation & Resilience**:
   - All query parameters validated via Zod schemas with strict min/max bounds (`page >= 1`, `limit <= 200`, bounded `q` length).
   - Every outbound `fetch()` enforces `AbortSignal.timeout()` (3.5s–8s depending on operation) and capped body reads (24KB for manifest inspection, 2MB for playlist/provider text).
   - Security response headers applied on all routes: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: SAMEORIGIN`.

---

## 9. Phased Implementation Roadmap & Exit Criteria

| Phase | Scope | Exit Criteria |
|---|---|---|
| **Phase 2** | Project Reset & Cloudflare Foundation (`wrangler.jsonc`, `package.json` `v0.0.0`, strict `tsconfig.json`, ESLint flat config, Vitest, delete legacy multi-sport files) | Clean repository tree, `npm run build` / `tsc --noEmit` green, zero legacy Sportify files. |
| **Phase 3** | Pure-Edge Crypto Engine (`src/crypto/*`) + Golden Vector Suite | 100% pass across all 6 CS3 ciphers + EnvelopeCrypto using zero `node:crypto` and zero `Buffer`. |
| **Phase 4** | Resilient CS3 Provider Adapters (`src/providers/*`) & Singleflight Firebase RC | All 6 providers cleanly migrated with shared base utilities, M3U/DRM/TokenApi parsers, and exact constants preserved. |
| **Phase 5** | Cricket-First Domain Engine (`src/domain/*`) | 100% pass on cricket classifier (zero non-cricket leakage), squad collision tests (`IND` vs `IND-W`, `MI` vs `MICT`), order-independent dedup, stream ranking, and typo-tolerant search. |
| **Phase 6** | Tiered Cloudflare Storage, Circuit Breakers & Scheduled Ingestion (`src/storage/*`, `src/ingestion/*`) | L1 + Cache API + KV snapshot pipeline with zero-binding fallback, singleflight SWR, and `scheduled()` handler tested. |
| **Phase 7** | 24KB Manifest Inspector & Hardened 6-Scheme Edge Proxy (`src/streaming/*`) | SSRF bypass suite (decimal/hex/octal/IPv6-mapped/3xx redirects) 100% blocked; HLS/DASH manifest parser, ClearKey detection, quality filter, and credential redaction verified. |
| **Phase 8** | `/api/v1` Hono API, OpenAPI 3.1, Cricket Portal & Docs UI, `README.md`, & Full Verification | `tsc --noEmit`, `npm run lint`, full `vitest` suite, `wrangler deploy --dry-run`, and live browser visual verification on `http://localhost:3000` all passing with zero defects. |
