import { APP_NAME, APP_VERSION } from "../config/env";

export function renderDocsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME} API Documentation — OpenAPI 3.1 (v${APP_VERSION})</title>
  <meta name="description" content="Interactive OpenAPI 3.1 documentation and live endpoint runner for the Crease Cricket-Only Cloudflare Edge API." />
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
            pitch: { DEFAULT: '#14532D', hover: '#166534', soft: '#ECFDF3' }
          }
        }
      }
    };
  </script>
</head>
<body class="bg-canvas text-ink font-sans antialiased">
  <header class="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-border">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <a href="/" class="flex items-center gap-2.5 text-ink font-semibold tracking-tight">
          <span class="w-7 h-7 rounded bg-pitch text-white flex items-center justify-center font-mono text-xs font-semibold">CR</span>
          <span class="text-base">${APP_NAME}</span>
        </a>
        <span class="text-xs font-mono text-muted border-l border-border pl-3">v${APP_VERSION} · OpenAPI 3.1</span>
      </div>
      <nav class="hidden md:flex items-center gap-6 text-sm font-medium">
        <a href="/portal" class="text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent">Matches</a>
        <a href="/portal#channels" class="text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent">24/7 Channels</a>
        <a href="/portal#providers" class="text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent">CS3 Providers</a>
        <a href="/changelog" class="text-muted hover:text-ink py-4 -mb-px border-b-2 border-transparent">Changelog</a>
        <a href="/docs" class="text-pitch border-b-2 border-pitch py-4 -mb-px">API Docs</a>
      </nav>
      <div class="flex items-center gap-3 text-sm font-medium">
        <a href="/openapi.json" class="font-mono text-xs px-2.5 py-1.5 rounded border border-border bg-canvas text-ink hover:border-pitch">openapi.json</a>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
    <section class="lg:col-span-5 bg-surface border border-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-border flex items-center justify-between">
        <h1 class="text-sm font-semibold text-ink">API v1 Endpoints</h1>
        <span id="endpoint-count" class="text-xs font-mono text-muted">—</span>
      </div>
      <div id="endpoint-list" class="divide-y divide-border max-h-[76vh] overflow-y-auto">
        <div class="p-6 text-xs text-muted">Loading OpenAPI 3.1 schema…</div>
      </div>
    </section>

    <section class="lg:col-span-7 bg-surface border border-border rounded-lg p-5 space-y-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span id="active-method" class="text-xs font-mono font-semibold text-pitch bg-pitch-soft px-2 py-0.5 rounded">GET</span>
          <code id="active-path" class="text-sm font-mono font-semibold text-ink">/health</code>
        </div>
        <p id="active-summary" class="text-xs text-muted">Select an endpoint on the left to test it live against this Cloudflare Edge Worker.</p>
      </div>

      <form id="try-form" class="flex gap-2">
        <input
          id="try-url"
          type="text"
          value="/health"
          class="flex-1 h-9 px-3 text-xs font-mono bg-canvas border border-border rounded-md focus:outline-none focus:border-pitch text-ink"
        />
        <button type="submit" class="h-9 px-4 text-xs font-medium bg-pitch text-white rounded-md hover:bg-pitch-hover">
          Send Request
        </button>
      </form>

      <div id="response-meta" class="flex flex-wrap items-center gap-4 text-xs font-mono text-muted border-b border-border pb-2">
        <span>Status: <strong id="res-status" class="text-ink">—</strong></span>
        <span>Latency: <strong id="res-latency" class="text-ink">—</strong></span>
        <span>Version: <strong id="res-version" class="text-ink">—</strong></span>
        <span>Cache: <strong id="res-cache" class="text-ink">—</strong></span>
      </div>

      <pre id="response-body" class="p-4 bg-canvas border border-border rounded-md text-xs font-mono text-ink overflow-x-auto max-h-[54vh] whitespace-pre-wrap">Click "Send Request" to inspect the live response envelope.</pre>
    </section>
  </main>

  <script>
    (function () {
      const listEl = document.getElementById('endpoint-list');
      const countEl = document.getElementById('endpoint-count');
      const activePathEl = document.getElementById('active-path');
      const activeSummaryEl = document.getElementById('active-summary');
      const tryUrlEl = document.getElementById('try-url');
      const tryForm = document.getElementById('try-form');
      const resStatus = document.getElementById('res-status');
      const resLatency = document.getElementById('res-latency');
      const resVersion = document.getElementById('res-version');
      const resCache = document.getElementById('res-cache');
      const resBody = document.getElementById('response-body');

      async function runRequest(path) {
        const start = performance.now();
        resBody.textContent = 'Fetching ' + path + '…';
        try {
          const res = await fetch(path);
          const ms = Math.round(performance.now() - start);
          resStatus.textContent = String(res.status);
          resLatency.textContent = ms + ' ms';
          resVersion.textContent = res.headers.get('x-crease-version') || '0.0.0';
          resCache.textContent = res.headers.get('x-crease-edge-cache') || 'N/A';
          const text = await res.text();
          try {
            resBody.textContent = JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            resBody.textContent = text;
          }
        } catch (err) {
          resStatus.textContent = 'ERR';
          resBody.textContent = String(err);
        }
      }

      async function init() {
        const res = await fetch('/openapi.json');
        const spec = await res.json();
        const entries = Object.entries(spec.paths || {});
        countEl.textContent = entries.length + ' routes';
        while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

        entries.forEach(([path, methods]) => {
          const op = methods.get || Object.values(methods)[0];
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'w-full text-left px-4 py-3 hover:bg-canvas transition-colors block';

          const top = document.createElement('div');
          top.className = 'flex items-center gap-2';
          const mBadge = document.createElement('span');
          mBadge.className = 'text-[11px] font-mono font-semibold text-pitch';
          mBadge.textContent = 'GET';
          const pText = document.createElement('span');
          pText.className = 'text-xs font-mono text-ink truncate';
          pText.textContent = path;
          top.appendChild(mBadge);
          top.appendChild(pText);

          const desc = document.createElement('div');
          desc.className = 'mt-0.5 text-xs text-muted truncate';
          desc.textContent = op?.summary || '';

          btn.appendChild(top);
          btn.appendChild(desc);
          btn.addEventListener('click', () => {
            activePathEl.textContent = path;
            activeSummaryEl.textContent = op?.summary || '';
            const sample = path
              .replace('{matchId}', 'crk_sample')
              .replace('{seriesId}', 'ipl')
              .replace('{teamId}', 'IND')
              .replace('{providerId}', 'cricify');
            tryUrlEl.value = sample === '/api/v1/search' ? '/api/v1/search?q=India' : sample;
            if (!sample.includes('inspect') && !sample.includes('proxy') && !sample.includes('sse')) {
              void runRequest(tryUrlEl.value);
            }
          });
          listEl.appendChild(btn);
        });

        void runRequest('/health');
      }

      tryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        void runRequest(tryUrlEl.value.trim() || '/health');
      });

      void init();
    })();
  </script>
</body>
</html>`;
}
