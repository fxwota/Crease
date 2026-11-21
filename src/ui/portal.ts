import { APP_NAME, APP_VERSION } from "../config/env";

export function renderPortalHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME} — Cricket Edge API & Stream Bench (v${APP_VERSION})</title>
  <meta name="description" content="Crease is a Cloudflare Workers-native Cricket-Only Edge API providing normalized live cricket fixtures, canonical squads, 24KB manifest inspection, and hardened edge streaming." />
  <meta property="og:title" content="${APP_NAME} — Cricket Edge API (v${APP_VERSION})" />
  <meta property="og:description" content="Cloudflare Workers-native Cricket Live Fixtures, 24/7 Channels, Manifest Inspector & Edge Stream Proxy." />
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
            crimson: { soft: '#FEF2F2', ink: '#B91C1C' }
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
        <button id="nav-fixtures" type="button" class="text-pitch border-b-2 border-pitch py-4 -mb-px">Matches</button>
        <button id="nav-channels" type="button" class="text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent">24/7 Channels</button>
        <button id="nav-providers" type="button" class="text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent">CS3 Providers</button>
        <a href="/changelog" class="text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent">Changelog</a>
        <a href="/docs" class="text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent">API Docs</a>
      </nav>

      <div class="flex items-center gap-2.5">
        <div class="relative">
          <input
            id="global-search"
            type="search"
            placeholder="Search squads, series, channels..."
            class="w-44 sm:w-64 h-8 pl-3 pr-3 text-xs bg-canvas border border-border rounded-md focus:outline-none focus:border-pitch text-ink placeholder:text-muted"
          />
        </div>
        <a href="/openapi.json" class="hidden sm:inline-flex items-center h-8 px-2.5 text-xs font-mono text-muted hover:text-ink border border-border rounded-md bg-surface">OpenAPI</a>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
    <!-- Top Metric Strip -->
    <section aria-label="Catalog Overview" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-surface border border-border rounded-lg p-4">
        <div class="text-xs font-medium text-muted">Live Cricket Matches</div>
        <div id="kpi-live" class="mt-1.5 text-2xl font-semibold tnum text-ink">—</div>
        <div id="kpi-live-sub" class="mt-1 text-xs text-muted">Across 6 CS3 providers</div>
      </div>
      <div class="bg-surface border border-border rounded-lg p-4">
        <div class="text-xs font-medium text-muted">Total Fixtures</div>
        <div id="kpi-matches" class="mt-1.5 text-2xl font-semibold tnum text-ink">—</div>
        <div id="kpi-upcoming-sub" class="mt-1 text-xs text-muted">Deduplicated canonically</div>
      </div>
      <div class="bg-surface border border-border rounded-lg p-4">
        <div class="text-xs font-medium text-muted">24/7 Cricket Channels</div>
        <div id="kpi-channels" class="mt-1.5 text-2xl font-semibold tnum text-ink">—</div>
        <div id="kpi-streams-sub" class="mt-1 text-xs text-muted">Filtered cricket networks</div>
      </div>
      <div class="bg-surface border border-border rounded-lg p-4">
        <div class="text-xs font-medium text-muted">Healthy CS3 Providers</div>
        <div id="kpi-providers" class="mt-1.5 text-2xl font-semibold tnum text-ink">—</div>
        <div id="kpi-cache-sub" class="mt-1 text-xs font-mono text-muted">Edge cache ready</div>
      </div>
    </section>

    <!-- Primary Workbench Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left 8 Columns: Explorer -->
      <section class="lg:col-span-8 bg-surface border border-border rounded-lg overflow-hidden">
        <div class="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <h1 id="panel-title" class="text-sm font-semibold text-ink">Cricket Fixtures</h1>
            <span id="result-count" class="text-xs font-mono text-muted tnum">0 items</span>
          </div>

          <div id="match-filters" class="flex flex-wrap items-center gap-2">
            <select id="filter-phase" aria-label="Filter by phase" class="h-8 px-2.5 text-xs bg-canvas border border-border rounded-md text-ink focus:outline-none focus:border-pitch">
              <option value="all">All Phases</option>
              <option value="live">Live Now</option>
              <option value="upcoming">Upcoming</option>
              <option value="pre_match">Pre-Match</option>
              <option value="completed">Completed</option>
            </select>
            <select id="filter-format" aria-label="Filter by format" class="h-8 px-2.5 text-xs bg-canvas border border-border rounded-md text-ink focus:outline-none focus:border-pitch">
              <option value="">All Formats</option>
              <option value="T20I">T20I</option>
              <option value="ODI">ODI</option>
              <option value="TEST">TEST</option>
              <option value="T20">T20 Franchise</option>
              <option value="HUNDRED">The Hundred</option>
              <option value="T10">T10</option>
              <option value="FIRST_CLASS">First-Class</option>
              <option value="LIST_A">List A</option>
            </select>
            <select id="filter-squad" aria-label="Filter by squad class" class="h-8 px-2.5 text-xs bg-canvas border border-border rounded-md text-ink focus:outline-none focus:border-pitch">
              <option value="">All Squads</option>
              <option value="MENS">Men's</option>
              <option value="WOMENS">Women's</option>
              <option value="FRANCHISE">Franchise</option>
              <option value="U19_MENS">U19 Men's</option>
              <option value="U19_WOMENS">U19 Women's</option>
              <option value="A_TEAM">A Teams</option>
              <option value="DOMESTIC">Domestic</option>
              <option value="LEGENDS">Legends</option>
            </select>
            <button id="btn-refresh" type="button" class="h-8 px-3 text-xs font-medium bg-pitch text-white rounded-md hover:bg-pitch-hover">
              Refresh
            </button>
          </div>
        </div>

        <div id="explorer-body" class="divide-y divide-border min-h-[340px]">
          <div class="p-8 text-center text-sm text-muted">Loading cricket catalog from edge snapshot…</div>
        </div>
      </section>

      <!-- Right 4 Columns: 24KB Manifest Inspector & Quick Export Bench -->
      <aside class="lg:col-span-4 space-y-5">
        <section class="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-ink">24KB Manifest Inspector</h2>
            <span class="text-xs font-mono text-muted">HLS / DASH</span>
          </div>
          <p class="text-xs text-muted leading-relaxed">
            Inspect any public <code class="font-mono text-ink">.m3u8</code> or <code class="font-mono text-ink">.mpd</code> manifest through the SSRF-hardened edge prober to verify renditions, audio tracks, encryption, and player compatibility.
          </p>
          <form id="inspect-form" class="space-y-2.5">
            <input
              id="inspect-url"
              type="url"
              required
              placeholder="https://cdn.example.com/live/master.m3u8"
              class="w-full h-9 px-3 text-xs font-mono bg-canvas border border-border rounded-md focus:outline-none focus:border-pitch text-ink"
            />
            <button type="submit" class="w-full h-8 text-xs font-medium bg-pitch text-white rounded-md hover:bg-pitch-hover">
              Inspect Manifest
            </button>
          </form>
          <div id="inspect-output" class="hidden pt-2 border-t border-border space-y-2 text-xs"></div>
        </section>

        <section class="bg-surface border border-border rounded-lg p-4 space-y-3">
          <h2 class="text-sm font-semibold text-ink">Quick Feeds & Endpoints</h2>
          <div class="space-y-2 text-xs">
            <a href="/api/v1/matches" target="_blank" class="flex items-center justify-between py-1.5 border-b border-border text-ink hover:text-pitch">
              <span class="font-mono">/api/v1/matches</span>
              <span class="text-muted">JSON</span>
            </a>
            <a href="/api/v1/playlist.m3u" target="_blank" class="flex items-center justify-between py-1.5 border-b border-border text-ink hover:text-pitch">
              <span class="font-mono">/api/v1/playlist.m3u</span>
              <span class="text-muted">IPTV M3U8</span>
            </a>
            <a href="/api/v1/epg.xml" target="_blank" class="flex items-center justify-between py-1.5 border-b border-border text-ink hover:text-pitch">
              <span class="font-mono">/api/v1/epg.xml</span>
              <span class="text-muted">XMLTV EPG</span>
            </a>
            <a href="/api/v1/stats" target="_blank" class="flex items-center justify-between py-1.5 border-b border-border text-ink hover:text-pitch">
              <span class="font-mono">/api/v1/stats</span>
              <span class="text-muted">Catalog Stats</span>
            </a>
            <a href="/changelog" class="flex items-center justify-between py-1.5 border-b border-border text-ink hover:text-pitch">
              <span class="font-mono">/changelog</span>
              <span class="text-muted">Release Ledger</span>
            </a>
            <a href="/docs" class="flex items-center justify-between py-1.5 text-pitch font-medium">
              <span>Interactive OpenAPI 3.1 Docs</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </section>
      </aside>
    </div>
  </main>

  <script>
    (function () {
      let currentTab = 'fixtures';

      const els = {
        kpiLive: document.getElementById('kpi-live'),
        kpiMatches: document.getElementById('kpi-matches'),
        kpiChannels: document.getElementById('kpi-channels'),
        kpiProviders: document.getElementById('kpi-providers'),
        kpiCacheSub: document.getElementById('kpi-cache-sub'),
        panelTitle: document.getElementById('panel-title'),
        resultCount: document.getElementById('result-count'),
        explorerBody: document.getElementById('explorer-body'),
        matchFilters: document.getElementById('match-filters'),
        phase: document.getElementById('filter-phase'),
        format: document.getElementById('filter-format'),
        squad: document.getElementById('filter-squad'),
        search: document.getElementById('global-search'),
        navFixtures: document.getElementById('nav-fixtures'),
        navChannels: document.getElementById('nav-channels'),
        navProviders: document.getElementById('nav-providers'),
        refreshBtn: document.getElementById('btn-refresh'),
        inspectForm: document.getElementById('inspect-form'),
        inspectUrl: document.getElementById('inspect-url'),
        inspectOutput: document.getElementById('inspect-output'),
      };

      function clearNode(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
      }

      function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
      }

      function setActiveTab(tab) {
        currentTab = tab;
        const map = {
          fixtures: els.navFixtures,
          channels: els.navChannels,
          providers: els.navProviders,
        };
        Object.entries(map).forEach(([k, btn]) => {
          if (k === tab) {
            btn.className = 'text-pitch border-b-2 border-pitch py-4 -mb-px';
          } else {
            btn.className = 'text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent';
          }
        });
        els.matchFilters.style.display = tab === 'fixtures' ? 'flex' : 'none';
        void loadActiveView();
      }

      async function loadStats() {
        try {
          const res = await fetch('/api/v1/stats');
          const json = await res.json();
          if (!json.ok) return;
          const t = json.data.totals;
          els.kpiLive.textContent = String(t.liveMatches);
          els.kpiMatches.textContent = String(t.matches);
          els.kpiChannels.textContent = String(t.channels);
          els.kpiProviders.textContent = t.healthyProviders + ' / ' + t.totalProviders;
          els.kpiCacheSub.textContent = 'Cache: ' + (json.meta.cache || 'EDGE') + ' · v' + json.meta.version;
        } catch {
          els.kpiCacheSub.textContent = 'Stats unavailable';
        }
      }

      function renderEmpty(message) {
        clearNode(els.explorerBody);
        const box = el('div', 'p-8 text-center space-y-1.5');
        box.appendChild(el('div', 'text-sm font-medium text-ink', message));
        box.appendChild(el('div', 'text-xs text-muted', 'Try widening your filters, inspecting a manifest URL on the right, or exploring /docs.'));
        els.explorerBody.appendChild(box);
      }

      async function loadFixtures() {
        els.panelTitle.textContent = 'Cricket Fixtures';
        const params = new URLSearchParams();
        if (els.phase.value && els.phase.value !== 'all') params.set('phase', els.phase.value);
        if (els.format.value) params.set('format', els.format.value);
        if (els.squad.value) params.set('squadClass', els.squad.value);
        if (els.search.value.trim()) params.set('q', els.search.value.trim());

        const res = await fetch('/api/v1/matches?' + params.toString());
        const json = await res.json();
        if (!json.ok) {
          renderEmpty('Unable to load cricket fixtures.');
          return;
        }

        const list = json.data.matches || [];
        els.resultCount.textContent = list.length + (list.length === 1 ? ' match' : ' matches');
        if (list.length === 0) {
          renderEmpty('No cricket fixtures matched the active filters.');
          return;
        }

        clearNode(els.explorerBody);
        list.forEach((m) => {
          const row = el('div', 'p-4 hover:bg-canvas/60 transition-colors space-y-2');
          const top = el('div', 'flex items-start justify-between gap-4');

          const left = el('div', 'min-w-0');
          left.appendChild(el('div', 'text-sm font-semibold text-ink truncate', m.title));
          const metaLine = [
            m.series.name,
            m.format,
            m.squadClass,
            m.streamCount + (m.streamCount === 1 ? ' stream' : ' streams'),
            m.providers.join(', '),
          ].join(' · ');
          left.appendChild(el('div', 'mt-0.5 text-xs text-muted font-mono truncate', metaLine));

          const statusText = m.phase.toUpperCase();
          const statusCls = m.phase === 'live'
            ? 'text-xs font-mono font-semibold text-crimson-ink bg-crimson-soft px-2 py-0.5 rounded'
            : 'text-xs font-mono text-muted bg-canvas px-2 py-0.5 rounded border border-border';
          const statusEl = el('span', statusCls, statusText);

          top.appendChild(left);
          top.appendChild(statusEl);
          row.appendChild(top);

          if (m.streams && m.streams.length > 0) {
            const actions = el('div', 'flex flex-wrap items-center gap-3 pt-1 text-xs');
            m.streams.slice(0, 3).forEach((s) => {
              const protoTag = s.protocol === 'unknown'
                ? (s.url.startsWith('http') ? 'LIVE' : 'EDGE')
                : s.protocol.toUpperCase();
              const btn = el(
                'button',
                'font-mono text-pitch hover:underline',
                s.label + ' (' + s.quality + ' · ' + protoTag + ' · ' + s.language + ')'
              );
              btn.type = 'button';
              btn.addEventListener('click', () => {
                els.inspectUrl.value = s.url;
                void runInspect(s.url);
              });
              actions.appendChild(btn);
            });
            row.appendChild(actions);
          }

          els.explorerBody.appendChild(row);
        });
      }

      async function loadChannels() {
        els.panelTitle.textContent = '24/7 Cricket Channels';
        const params = new URLSearchParams();
        if (els.search.value.trim()) params.set('q', els.search.value.trim());
        const res = await fetch('/api/v1/channels?' + params.toString());
        const json = await res.json();
        const list = (json.ok && json.data.channels) ? json.data.channels : [];
        els.resultCount.textContent = list.length + (list.length === 1 ? ' channel' : ' channels');
        if (list.length === 0) {
          renderEmpty('No 24/7 cricket channels currently indexed.');
          return;
        }
        clearNode(els.explorerBody);
        list.forEach((ch) => {
          const row = el('div', 'p-4 flex items-center justify-between gap-4 hover:bg-canvas/60');
          const left = el('div', 'min-w-0');
          left.appendChild(el('div', 'text-sm font-medium text-ink truncate', ch.name));
          left.appendChild(el('div', 'text-xs font-mono text-muted', [ch.category, ch.language, ch.streamCount + ' feeds', ch.providers.join(', ')].join(' · ')));
          row.appendChild(left);
          if (ch.streams && ch.streams[0] && ch.streams[0].url.startsWith('http')) {
            const inspectBtn = el('button', 'text-xs font-mono text-pitch hover:underline shrink-0', 'Inspect');
            inspectBtn.type = 'button';
            inspectBtn.addEventListener('click', () => {
              els.inspectUrl.value = ch.streams[0].url;
              void runInspect(ch.streams[0].url);
            });
            row.appendChild(inspectBtn);
          }
          els.explorerBody.appendChild(row);
        });
      }

      async function loadProviders() {
        els.panelTitle.textContent = 'CS3 Upstream Providers (6 Native Cryptographic Pipelines)';
        const res = await fetch('/api/v1/providers');
        const json = await res.json();
        const list = (json.ok && json.data.providers) ? json.data.providers : [];
        els.resultCount.textContent = list.length + ' providers';
        clearNode(els.explorerBody);
        list.forEach((p) => {
          const row = el('div', 'p-4 space-y-1.5');
          const header = el('div', 'flex items-center justify-between gap-3');
          const nameWrap = el('div', 'flex items-center gap-2');
          nameWrap.appendChild(el('span', 'text-sm font-semibold text-ink', p.displayName));
          nameWrap.appendChild(el('span', 'text-xs font-mono text-muted', p.customScheme));
          const st = p.status || {};
          const stateText = (st.ok ? 'ONLINE' : 'STANDBY') + ' · ' + (st.circuitState || 'CLOSED');
          const stateCls = st.ok
            ? 'text-xs font-mono text-pitch bg-pitch-soft px-2 py-0.5 rounded'
            : 'text-xs font-mono text-amber-ink bg-amber-soft px-2 py-0.5 rounded';
          header.appendChild(nameWrap);
          header.appendChild(el('span', stateCls, stateText));
          row.appendChild(header);
          row.appendChild(el('div', 'text-xs text-muted', p.cryptoPipeline));
          row.appendChild(el('div', 'text-xs font-mono text-muted tnum', 'Package: ' + p.packageName + ' · Cricket kept: ' + (st.cricketEventsKept || 0) + ' · Non-cricket dropped: ' + (st.nonCricketDropped || 0) + ' · Latency: ' + (st.latencyMs || 0) + 'ms'));
          els.explorerBody.appendChild(row);
        });
      }

      async function runInspect(targetUrl) {
        clearNode(els.inspectOutput);
        els.inspectOutput.classList.remove('hidden');
        els.inspectOutput.appendChild(el('div', 'text-muted font-mono', 'Probing 24KB manifest…'));
        try {
          const res = await fetch('/api/v1/streams/inspect?url=' + encodeURIComponent(targetUrl));
          const json = await res.json();
          clearNode(els.inspectOutput);
          if (!json.ok) {
            els.inspectOutput.appendChild(el('div', 'text-crimson-ink font-mono', (json.error?.code || 'ERROR') + ': ' + (json.error?.message || 'Inspection failed')));
            return;
          }
          const ins = json.data.inspection;
          const summary = [
            ['Reachable', ins.reachable ? 'YES (HTTP ' + (ins.httpStatus || 200) + ')' : 'NO'],
            ['Protocol', ins.protocol.toUpperCase() + (ins.isLowLatency ? ' (Low-Latency)' : '')],
            ['Encryption', ins.encryption],
            ['Renditions', ins.renditions.length ? ins.renditions.map((r) => r.label).join(', ') : 'None detected'],
            ['Player', ins.compatibility.recommendedPlayer],
            ['Latency', ins.latencyMs + ' ms (' + ins.bytesInspected + ' B)'],
          ];
          summary.forEach(([k, v]) => {
            const line = el('div', 'flex justify-between gap-2 py-1 border-b border-border/60');
            line.appendChild(el('span', 'text-muted', k));
            line.appendChild(el('span', 'font-mono text-ink text-right', v));
            els.inspectOutput.appendChild(line);
          });
        } catch (err) {
          clearNode(els.inspectOutput);
          els.inspectOutput.appendChild(el('div', 'text-crimson-ink font-mono', 'Network error inspecting manifest.'));
        }
      }

      async function loadActiveView() {
        if (currentTab === 'fixtures') await loadFixtures();
        else if (currentTab === 'channels') await loadChannels();
        else await loadProviders();
      }

      els.navFixtures.addEventListener('click', () => setActiveTab('fixtures'));
      els.navChannels.addEventListener('click', () => setActiveTab('channels'));
      els.navProviders.addEventListener('click', () => setActiveTab('providers'));
      els.phase.addEventListener('change', () => void loadFixtures());
      els.format.addEventListener('change', () => void loadFixtures());
      els.squad.addEventListener('change', () => void loadFixtures());
      els.search.addEventListener('input', () => void loadActiveView());
      els.refreshBtn.addEventListener('click', () => { void loadStats(); void loadActiveView(); });
      els.inspectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = els.inspectUrl.value.trim();
        if (url) void runInspect(url);
      });

      void loadStats();
      const initialHash = window.location.hash.replace('#', '');
      if (initialHash === 'channels' || initialHash === 'providers') {
        setActiveTab(initialHash);
      } else {
        void loadFixtures();
      }
    })();
  </script>
</body>
</html>`;
}
