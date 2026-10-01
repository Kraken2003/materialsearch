# Material Atlas

Search open materials databases by element composition, then discover related literature. Database materials remain visible and exportable even when no references or papers are available.

## Run locally

Node.js 22.12+ or 24 is recommended.

```sh
cd /Users/prithvi/Desktop/materialsearch
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. COD, Materials Cloud, and Crossref work without keys. No demo results are substituted for failed live requests.

Optional: put your free Materials Project key in `MP_API_KEY` and OpenAlex key in `OPENALEX_API_KEY` in `.env.local`. Restart the development server after changing configuration. Never use `NEXT_PUBLIC_` for keys.

## Data sources and reuse

| Source | Integration | Attribution and access |
| --- | --- | --- |
| [COD](https://www.crystallography.net/cod/) | OPTIMADE v1; experimental structural records | CC0. Acknowledge COD and original structural-data authors. |
| [Materials Cloud MC3D](https://archive.materialscloud.org/records/szjaf-cfv74) | PBE-v1 OPTIMADE; computed relaxed structures | CC BY 4.0 dataset. Cite Huber et al., MC3D, DOI [10.24435/materialscloud:jn-ac](https://doi.org/10.24435/materialscloud:jn-ac). We expose normalized metadata from public relaxed structures; copyrighted original ICSD/MPDS source structures are not downloaded or redistributed. |
| [Materials Project](https://docs.materialsproject.org/downloading-data/using-the-api/getting-started) | Current materials/summary REST API | Requires a free account key. Check current account/API-use and dataset-specific terms before public use. No blanket reuse license is asserted. GNoME batch is excluded. |
| [Crossref](https://www.crossref.org/documentation/retrieve-metadata/rest-api/) | Bibliographic metadata search | Public API; no registration required. Supply `CONTACT_EMAIL` for polite access. Metadata availability varies; this app does not reproduce abstracts or paper full text. |
| [OpenAlex](https://help.openalex.org/access/pricing/) | Works search, DOI, authors, open-access links | Optional free key. Current daily free allowance is limited; keep caps conservative and do not purchase credits. |

The two keyless materials endpoints returned real Si–O records during initial verification on October 1, 2026. Endpoints, uptime, quotas, and terms can change.

References supplied by a record are separate from general dataset citations and search-discovered papers. Literature results are relevance candidates, not evidence that a paper synthesized or validated the exact structure. Formula aliases and full element names help discovery, but this is not an exhaustive systematic-review search.

## Public deployment on Vercel

1. Import this directory as a Next.js project. Build: `npm run build`. No database migrations are needed.
2. Create an Upstash Redis database on its free plan. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel environment variables. Do not enable paid overages.
3. Run `openssl rand -hex 32` yourself and put its output in `CURSOR_SECRET`. Keep this secret stable across deployments.
4. Add optional API keys and `CONTACT_EMAIL`. Public Materials Project access also requires `MP_PUBLIC_USE_CONFIRMED=true` after reviewing your account's current terms. Its adapter remains disabled in production until both conditions are met.
5. Deploy. Confirm `/api/providers` reports `searchReady: true`, then perform a live composition search, pagination, CSV export, and literature search.

Production search fails closed when shared quota storage or cursor signing is absent. Redis outages also prevent uncached requests from bypassing limits. Local development without Redis uses bounded process-local caches and counters; this mode is not a substitute for shared public limits.

The app makes no paid AI calls or paid fallback requests. Hosting, Redis operations, and external API allowances remain subject to provider plans; application request caps cannot guarantee a zero hosting bill. Start on free plans and monitor their dashboards.

## Quotas and failure behavior

- Per-client limit: 12 API calls/minute. On Vercel, client identity uses Vercel's forwarded IP header and stores only its hash. Other hosts share one conservative client bucket.
- Shared public limit: 1,000 API calls/day. Source fan-out in the UI uses one API call per selected database. Literature requests use another call.
- Upstream daily cache-miss caps: COD 300, Materials Cloud 300, Materials Project 200, Crossref 400, OpenAlex 50. UTC daily reset.
- Materials cached 15 minutes; paper metadata cached 1 hour. Concurrent identical calls coalesce locally and through Redis leases.
- Every upstream request has a 12-second timeout, a bounded response size, and no automatic retry. Rate/quota failures are displayed independently.
- Configure caps in the environment template. No arbitrary URLs are accepted: only fixed provider endpoints and signed, validated pagination links.
- Redis usage also needs monitoring. Rate limits reduce upstream costs; requests rejected at the guard still use quota-storage operations.

## API

`POST /api/materials/search` accepts:

```json
{"include":["Fe","O"],"exclude":["Pb"],"mode":"contains","sources":["cod","mcloud"],"cursors":{}}
```

Returns normalized `records`, the validated `query`, and per-source `sources` statuses. Each source can return an opaque `nextCursor`. Pass it back under that source's identifier with the same composition. Cursors expire after one hour. Statuses: `ok`, `empty`, `unavailable`, `quota-limited`, `disabled`. Failed sources do not remove successful records.

`POST /api/papers/search` accepts:

```json
{"formula":"Fe2O3","elements":["Fe","O"],"keywords":"magnetic"}
```

Returns DOI-deduplicated `papers`, the bibliographic query, and independent literature-source statuses. The materials API never calls or depends on the papers API.

`GET /api/providers` returns source availability and public configuration readiness; credentials are never returned.

## Verify

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:browser
npm run smoke
```

Unit tests cover matching, validation, normalization, distinct structures, safe CSV exports, signed pagination, partial outages, independent literature failure, caching and quotas. Browser tests use explicitly isolated API fixtures and check desktop/mobile interactions. `npm run smoke` makes real upstream requests, compares records to their original API entries, and checks live pagination and literature. It needs internet access and consumes a few source requests.

Materials Project, OpenAlex, and real Upstash integration require your credentials to verify live. No public deployment is created by these commands.

## Extending sources

Add a fixed endpoint and public metadata in `src/server/providers.ts`, a normalization adapter in `src/server/materials.ts`, and the identifier in `src/lib/types.ts`. Update host allowlists, quotas, and validation tests. OPTIMADE providers share composition filtering, but their metadata and reuse terms still need individual verification.
