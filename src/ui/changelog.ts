import { APP_NAME, APP_VERSION } from "../config/env";

export function renderChangelogHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME} Changelog — Release Ledger &amp; Version History (v${APP_VERSION})</title>
  <meta name="description" content="Structured release history and Conventional Commits ledger for Crease (crease-api), rendered dynamically from CHANGELOG.md." />
  <meta property="og:title" content="${APP_NAME} Changelog (v${APP_VERSION})" />
  <meta property="og:description" content="Keep a Changelog 1.1.0 + Semantic Versioning 2.0.0 + Conventional Commits release ledger for Crease." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
          },
          colors: {
            canvas: '#F6F7F4',
            surface: '#FFFFFF',
            ink: '#0F172A',
            muted: '#52606D',
            border: '#E2E7E2',
            pitch: { DEFAULT: '#14532D', hover: '#166534', soft: '#ECFDF3', ink: '#14532D' },
            amber: { soft: '#FEF7E6', ink: '#9A5B00' },
            crimson: { soft: '#FEF2F2', ink: '#B91C1C' },
            sky: { soft: '#EFF6FF', ink: '#1D4ED8' },
            teal: { soft: '#F0FDFA', ink: '#0F766E' }
          }
        }
      }
    };
  </script>
  <style>
    .tnum { font-variant-numeric: tabular-nums; }
  </style>
</head>
<body class="bg-canvas text-ink font-sans antialiased selection:bg-pitch-soft selection:text-pitch">
  <header class="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-border">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <a href="/" class="flex items-center gap-2.5 text-ink font-semibold tracking-tight">
          <span class="w-7 h-7 rounded bg-pitch text-white flex items-center justify-center font-mono text-xs font-semibold">CR</span>
          <span class="text-base">${APP_NAME}</span>
        </a>
        <span class="text-xs font-mono text-muted border-l border-border pl-3">v${APP_VERSION}</span>
      </div>

      <nav class="hidden md:flex items-center gap-6 text-sm font-medium">
        <a href="/portal" class="text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent">Matches</a>
        <a href="/portal#channels" class="text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent">24/7 Channels</a>
        <a href="/portal#providers" class="text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent">CS3 Providers</a>
        <a href="/changelog" class="text-pitch border-b-2 border-pitch py-4 -mb-px">Changelog</a>
        <a href="/docs" class="text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent">API Docs</a>
      </nav>

      <div class="flex items-center gap-2.5">
        <input
          id="cl-search"
          type="search"
          placeholder="Search commits, scopes, versions..."
          class="w-44 sm:w-64 h-8 pl-3 pr-3 text-xs bg-canvas border border-border rounded-md focus:outline-none focus:border-pitch text-ink placeholder:text-muted"
        />
        <a href="/changelog.md" target="_blank" class="hidden sm:inline-flex items-center h-8 px-2.5 text-xs font-mono text-muted hover:text-ink border border-border rounded-md bg-surface">CHANGELOG.md</a>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
    <!-- Top Release Strip -->
    <section aria-label="Release Summary" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-surface border border-border rounded-lg p-4">
        <div class="text-xs font-medium text-muted">Active Release</div>
        <div id="kpi-version" class="mt-1.5 text-2xl font-semibold font-mono tnum text-pitch">v${APP_VERSION}</div>
        <div id="kpi-date" class="mt-1 text-xs font-mono text-muted">Loading CHANGELOG.md…</div>
      </div>
      <div class="bg-surface border border-border rounded-lg p-4">
        <div class="text-xs font-medium text-muted">Logged Changes</div>
        <div id="kpi-changes" class="mt-1.5 text-2xl font-semibold tnum text-ink">—</div>
        <div id="kpi-releases" class="mt-1 text-xs text-muted">Across all tagged releases</div>
      </div>
      <div class="bg-surface border border-border rounded-lg p-4">
        <div class="text-xs font-medium text-muted">Source of Truth</div>
        <div class="mt-1.5 text-lg font-semibold font-mono text-ink">CHANGELOG.md</div>
        <div class="mt-1 text-xs text-muted">Parsed live via <span class="font-mono">/api/v1/changelog</span></div>
      </div>
      <div class="bg-surface border border-border rounded-lg p-4">
        <div class="text-xs font-medium text-muted">Versioning Standard</div>
        <div class="mt-1.5 text-lg font-semibold text-ink">SemVer 2.0.0</div>
        <div class="mt-1 text-xs text-muted">Keep a Changelog · Conventional Commits</div>
      </div>
    </section>

    <!-- Primary Two-Column Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left 8 Columns: Release Ledger -->
      <section class="lg:col-span-8 space-y-4">
        <div class="bg-surface border border-border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
          <div id="type-filters" class="flex flex-wrap items-center gap-1.5"></div>
          <div class="flex items-center gap-2 text-xs font-mono text-muted">
            <span id="visible-count" class="tnum">—</span>
            <a href="/api/v1/changelog" target="_blank" class="text-pitch hover:underline">JSON</a>
          </div>
        </div>

        <div id="releases-container" class="space-y-4">
          <div class="bg-surface border border-border rounded-lg p-8 text-center text-sm text-muted">
            Fetching structured changelog from <code class="font-mono">/api/v1/changelog</code>…
          </div>
        </div>
      </section>

      <!-- Right 4 Columns: Governance & Release CLI -->
      <aside class="lg:col-span-4 space-y-5">
        <section class="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-ink">Conventional Commit Legend</h2>
            <span class="text-xs font-mono text-muted">v1.0.0</span>
          </div>
          <div class="divide-y divide-border text-xs">
            <div class="py-2 flex items-center justify-between gap-2">
              <span class="font-mono font-semibold text-pitch bg-pitch-soft px-2 py-0.5 rounded">feat(scope):</span>
              <span class="text-muted text-right">New capability · MINOR bump</span>
            </div>
            <div class="py-2 flex items-center justify-between gap-2">
              <span class="font-mono font-semibold text-crimson-ink bg-crimson-soft px-2 py-0.5 rounded">fix(scope):</span>
              <span class="text-muted text-right">Bug correction · PATCH bump</span>
            </div>
            <div class="py-2 flex items-center justify-between gap-2">
              <span class="font-mono font-semibold text-amber-ink bg-amber-soft px-2 py-0.5 rounded">security(scope):</span>
              <span class="text-muted text-right">Hardening · PATCH bump</span>
            </div>
            <div class="py-2 flex items-center justify-between gap-2">
              <span class="font-mono font-semibold text-sky-ink bg-sky-soft px-2 py-0.5 rounded">perf(scope):</span>
              <span class="text-muted text-right">Edge speed · PATCH bump</span>
            </div>
            <div class="py-2 flex items-center justify-between gap-2">
              <span class="font-mono font-semibold text-teal-ink bg-teal-soft px-2 py-0.5 rounded">test(scope):</span>
              <span class="text-muted text-right">Vectors &amp; contract tests</span>
            </div>
            <div class="py-2 flex items-center justify-between gap-2">
              <span class="font-mono font-semibold text-muted bg-canvas border border-border px-2 py-0.5 rounded">docs / build:</span>
              <span class="text-muted text-right">Specs, Wrangler &amp; CI</span>
            </div>
          </div>
        </section>

        <section class="bg-surface border border-border rounded-lg p-4 space-y-3">
          <h2 class="text-sm font-semibold text-ink">Release Management CLI</h2>
          <p class="text-xs text-muted leading-relaxed">
            Crease enforces strict version parity across <code class="font-mono text-ink">package.json</code>, <code class="font-mono text-ink">src/config/env.ts</code>, and <code class="font-mono text-ink">CHANGELOG.md</code> on every lint run.
          </p>
          <div class="space-y-2 text-xs font-mono">
            <div class="p-2.5 rounded bg-canvas border border-border text-ink">
              <div class="text-[11px] text-muted mb-0.5"># Sync CHANGELOG.md into Worker bundle</div>
              <div>npm run changelog:sync</div>
            </div>
            <div class="p-2.5 rounded bg-canvas border border-border text-ink">
              <div class="text-[11px] text-muted mb-0.5"># Verify version &amp; changelog lockstep</div>
              <div>npm run release:check</div>
            </div>
            <div class="p-2.5 rounded bg-canvas border border-border text-ink">
              <div class="text-[11px] text-muted mb-0.5"># Cut a SemVer release from [Unreleased]</div>
              <div>npm run release -- minor</div>
            </div>
          </div>
        </section>

        <section class="bg-surface border border-border rounded-lg p-4 space-y-2.5 text-xs">
          <h2 class="text-sm font-semibold text-ink">Raw &amp; Machine Feeds</h2>
          <a href="/changelog.md" target="_blank" class="flex items-center justify-between py-1.5 border-b border-border text-ink hover:text-pitch">
            <span class="font-mono">/changelog.md</span>
            <span class="text-muted">text/markdown</span>
          </a>
          <a href="/api/v1/changelog" target="_blank" class="flex items-center justify-between py-1.5 border-b border-border text-ink hover:text-pitch">
            <span class="font-mono">/api/v1/changelog</span>
            <span class="text-muted">Parsed JSON</span>
          </a>
          <a href="/portal" class="flex items-center justify-between py-1.5 text-pitch font-medium">
            <span>Back to Cricket Portal</span>
            <span aria-hidden="true">&rarr;</span>
          </a>
        </section>
      </aside>
    </div>
  </main>

  <script>
    (function () {
      let activeType = 'all';
      let fullData = null;

      const els = {
        kpiVersion: document.getElementById('kpi-version'),
        kpiDate: document.getElementById('kpi-date'),
        kpiChanges: document.getElementById('kpi-changes'),
        kpiReleases: document.getElementById('kpi-releases'),
        typeFilters: document.getElementById('type-filters'),
        visibleCount: document.getElementById('visible-count'),
        container: document.getElementById('releases-container'),
        search: document.getElementById('cl-search'),
      };

      const TYPE_STYLES = {
        feat: 'text-pitch bg-pitch-soft',
        fix: 'text-crimson-ink bg-crimson-soft',
        security: 'text-amber-ink bg-amber-soft',
        perf: 'text-sky-ink bg-sky-soft',
        test: 'text-teal-ink bg-teal-soft',
        refactor: 'text-sky-ink bg-sky-soft',
        docs: 'text-muted bg-canvas border border-border',
        build: 'text-muted bg-canvas border border-border',
        chore: 'text-muted bg-canvas border border-border',
        breaking: 'text-white bg-crimson-ink',
        other: 'text-muted bg-canvas border border-border',
      };

      const FILTER_ORDER = ['all', 'feat', 'fix', 'security', 'perf', 'test', 'docs', 'build'];

      function clearNode(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
      }

      function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
      }

      function appendInlineMarkdown(parent, text) {
        const tick = String.fromCharCode(96);
        const tokenRx = new RegExp('(' + tick + '[^' + tick + ']+' + tick + '|\\\\*\\\\*[^*]+\\\\*\\\\*)', 'g');
        let lastIndex = 0;
        let match;
        while ((match = tokenRx.exec(text)) !== null) {
          if (match.index > lastIndex) {
            parent.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
          }
          const token = match[0];
          if (token.startsWith(tick) && token.endsWith(tick)) {
            parent.appendChild(
              el('code', 'font-mono text-[11px] bg-canvas border border-border/80 text-ink px-1 py-0.5 rounded', token.slice(1, -1))
            );
          } else if (token.startsWith('**') && token.endsWith('**')) {
            parent.appendChild(el('strong', 'font-semibold text-ink', token.slice(2, -2)));
          }
          lastIndex = match.index + token.length;
        }
        if (lastIndex < text.length) {
          parent.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
      }

      function renderFilterBar() {
        if (!fullData) return;
        clearNode(els.typeFilters);

        FILTER_ORDER.forEach((key) => {
          const count = key === 'all' ? fullData.totalChanges : (fullData.typeCounts[key] || 0);
          if (key !== 'all' && count === 0 && activeType !== key) return;

          const active = activeType === key;
          const btn = el(
            'button',
            active
              ? 'h-7 px-2.5 text-xs font-mono font-medium rounded-md bg-pitch text-white'
              : 'h-7 px-2.5 text-xs font-mono rounded-md bg-canvas border border-border text-muted hover:text-ink hover:border-pitch',
            key + ' (' + count + ')'
          );
          btn.type = 'button';
          btn.addEventListener('click', () => {
            activeType = key;
            renderFilterBar();
            void fetchFiltered();
          });
          els.typeFilters.appendChild(btn);
        });
      }

      function renderReleases(data) {
        clearNode(els.container);
        els.visibleCount.textContent =
          data.totalChanges + (data.totalChanges === 1 ? ' entry' : ' entries');

        if (!data.releases || data.releases.length === 0) {
          const empty = el('div', 'bg-surface border border-border rounded-lg p-8 text-center space-y-1.5');
          empty.appendChild(el('div', 'text-sm font-medium text-ink', 'No changelog entries matched your filter.'));
          empty.appendChild(el('div', 'text-xs text-muted', 'Try selecting "all" or clearing the search query.'));
          els.container.appendChild(empty);
          return;
        }

        data.releases.forEach((rel) => {
          const card = el('article', 'bg-surface border border-border rounded-lg overflow-hidden');

          // Release Header
          const head = el('div', 'px-5 py-4 border-b border-border bg-canvas/40 space-y-2');
          const topRow = el('div', 'flex flex-wrap items-center justify-between gap-2');

          const leftHead = el('div', 'flex flex-wrap items-center gap-2.5');
          leftHead.appendChild(el('h1', 'text-base font-mono font-semibold text-ink', 'v' + rel.version));
          if (rel.codename) {
            leftHead.appendChild(el('span', 'text-sm font-medium text-muted', '— ' + rel.codename));
          }
          if (rel.isPrerelease) {
            leftHead.appendChild(el('span', 'text-[11px] font-mono text-pitch bg-pitch-soft px-2 py-0.5 rounded', 'PRE-1.0 FOUNDATION'));
          }

          const rightHead = el('div', 'flex items-center gap-3 text-xs font-mono text-muted tnum');
          if (rel.date) rightHead.appendChild(el('span', '', rel.date));
          rightHead.appendChild(el('span', '', rel.totalChanges + ' changes'));

          topRow.appendChild(leftHead);
          topRow.appendChild(rightHead);
          head.appendChild(topRow);

          if (rel.summary) {
            const sumP = el('p', 'text-xs text-muted leading-relaxed');
            appendInlineMarkdown(sumP, rel.summary);
            head.appendChild(sumP);
          }

          card.appendChild(head);

          // Categories & Entries
          const body = el('div', 'divide-y divide-border');
          rel.categories.forEach((cat) => {
            const sec = el('div', 'p-5 space-y-3');
            const catHeader = el('div', 'flex items-center justify-between');
            catHeader.appendChild(el('h2', 'text-xs font-semibold uppercase tracking-wider text-muted', cat.name));
            catHeader.appendChild(el('span', 'text-xs font-mono text-muted tnum', cat.entries.length));
            sec.appendChild(catHeader);

            const list = el('ul', 'space-y-3');
            cat.entries.forEach((entry) => {
              const li = el('li', 'flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3');
              const badgeLabel = entry.scope
                ? entry.type + '(' + entry.scope + ')' + (entry.breaking ? '!' : '')
                : entry.type + (entry.breaking ? '!' : '');
              const badgeStyle = TYPE_STYLES[entry.breaking ? 'breaking' : entry.type] || TYPE_STYLES.other;
              const badge = el(
                'span',
                'inline-flex shrink-0 items-center text-[11px] font-mono font-semibold px-2 py-0.5 rounded ' + badgeStyle,
                badgeLabel
              );

              const textWrap = el('div', 'min-w-0 space-y-0.5 text-xs leading-relaxed');
              const titleEl = el('div', 'font-semibold text-ink');
              appendInlineMarkdown(titleEl, entry.title);
              textWrap.appendChild(titleEl);
              if (entry.description) {
                const descEl = el('p', 'text-muted');
                appendInlineMarkdown(descEl, entry.description);
                textWrap.appendChild(descEl);
              }

              li.appendChild(badge);
              li.appendChild(textWrap);
              list.appendChild(li);
            });

            sec.appendChild(list);
            body.appendChild(sec);
          });

          card.appendChild(body);
          els.container.appendChild(card);
        });
      }

      async function fetchFiltered() {
        const params = new URLSearchParams();
        if (activeType && activeType !== 'all') params.set('type', activeType);
        if (els.search.value.trim()) params.set('q', els.search.value.trim());

        const res = await fetch('/api/v1/changelog' + (params.toString() ? '?' + params.toString() : ''));
        const json = await res.json();
        if (!json.ok) return;
        renderReleases(json.data);
      }

      async function init() {
        try {
          const res = await fetch('/api/v1/changelog');
          const json = await res.json();
          if (!json.ok) throw new Error('Failed to load changelog');
          fullData = json.data;

          els.kpiVersion.textContent = 'v' + fullData.currentVersion;
          els.kpiDate.textContent = fullData.latestReleaseDate
            ? 'Released ' + fullData.latestReleaseDate
            : 'Pre-release baseline';
          els.kpiChanges.textContent = String(fullData.totalChanges);
          els.kpiReleases.textContent =
            fullData.totalReleases + (fullData.totalReleases === 1 ? ' tagged release' : ' tagged releases');

          renderFilterBar();
          renderReleases(fullData);
        } catch {
          clearNode(els.container);
          els.container.appendChild(
            el('div', 'bg-surface border border-border rounded-lg p-8 text-center text-sm text-crimson-ink', 'Unable to fetch /api/v1/changelog.')
          );
        }
      }

      els.search.addEventListener('input', () => void fetchFiltered());
      void init();
    })();
  </script>
</body>
</html>`;
}
