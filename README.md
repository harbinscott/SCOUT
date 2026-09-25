# SCOUT: Simple Commute Opportunity Utility Tool

SCOUT is a private, self-hosted commute-isochrone explorer. It shows irregular travel-time areas derived from the road network for one or more destinations, supports live traffic where Google supports it, and combines destinations as shared overlap, combined reach, or individual boundaries.

It is designed to run behind an existing Nginx HTTPS site at `https://<your-server>/scout/`. A hardened Docker container named `sc_app` listens only on `127.0.0.1:3001`; the host's Nginx terminates HTTPS and routes `/scout/*` to it, so SCOUT can share a server with other applications.

> **Preview warning (reviewed July 15, 2026):** Google Isochrones remains a pre-GA Preview. The contract, coverage, quota, availability, and pricing can change. Preview calls are currently priced at $0, but billing must still be enabled. Review the [current setup guide](https://developers.google.com/maps/documentation/isochrones/get-api-key), [REST reference](https://developers.google.com/maps/documentation/isochrones/reference/rest/v1/isochrones/generate), and [billing page](https://developers.google.com/maps/documentation/isochrones/usage-and-billing) before enabling live mode.

## Interface

SCOUT uses a focused mapping workspace rather than an admin dashboard:

- A compact dark header shows Mock, Connected, Configuration Required, or API Error status and the durable monthly external-call count.
- A 405-pixel control rail manages up to five destinations, three editable bands, travel settings, combination modes, and local presets.
- The map keeps its legend and calculation summary clear of the primary work area.
- On smaller screens, the controls become a bottom drawer.
- Mock mode uses bundled Austin sample destinations and irregular local polygon fixtures, so it remains fully reviewable without a Google credential or internet connection.

## Features

- Address and business search using the current `PlaceAutocompleteElement`, which manages autocomplete session tokens.
- Three nested, editable commute bands with ordered-duration validation.
- Driving, walking, and bicycling; To and From directions; current or traffic-unaware driving; three polygon fidelity levels; optional smoothing.
- Polygon and MultiPolygon support without dropping holes or disconnected regions.
- Turf-based intersection for **All destinations** and union for **Any destination**.
- Manual generation only, progress, cancellation, stale-response protection, partial-failure reporting, and an up-front request estimate.
- In-memory mock/future-provider TTL caching and identical in-flight request deduplication for every provider.
- A local request rate limit plus hourly and durable monthly external-call circuit breakers.
- Local settings, destinations, map position, and named presets stored in the browser.
- Current Traffic display overlay independent of the traffic setting used for calculation.
- Accurate Turf-computed result area as an optional secondary metric.
- Accessible labels, keyboard focus, large controls, high contrast, reduced-motion support, and responsive layout.

## Architecture

```text
Browser at https://<your-server>/scout/
        |
Host Nginx :443 (existing site certificate)
        | /scout/* -> http://127.0.0.1:3001
        v
SCOUT container
  ├─ React + TypeScript + Vite
  ├─ Google Maps JavaScript + Places (live mode)
  ├─ local sample map fixture (mock mode)
  ├─ Turf intersection / union / area
  └─ localStorage settings and presets
                 │ same-origin JSON
                 ▼
Express at /scout/api/
  ├─ Zod validation
  ├─ localhost/LAN rate limiter
  ├─ hourly + persistent monthly call limits
  ├─ policy-aware cache + in-flight deduplication
  └─ IsochroneProvider
       ├─ MockIsochroneProvider
       └─ GoogleIsochroneProvider ──► Google Isochrones API
```

The server credential is read from a Docker secret in live mode. It is never returned by an endpoint, logged, or bundled into the client. The browser Maps credential must be delivered to the browser by Google's design; protect it with website and API restrictions.

## Requirements

For Docker deployment:

- Ubuntu Server on AMD64
- Docker Engine with the Compose v2 plugin
- An existing host Nginx HTTPS site to add SCOUT's location blocks to (`/etc/nginx/sites-enabled/<your-site>`)
- A free loopback TCP port 3001 (configurable with `SC_HTTP_PORT`)
- A browser that trusts the certificate used by that Nginx site

For local development:

- Node.js 22 or later
- npm 10 or later
- Windows, macOS, or Linux

## Nginx integration

SCOUT does not compete for port 443 and does not handle certificates; the host's Nginx does. Its Compose port is deliberately bound to loopback:

```yaml
ports:
  - "127.0.0.1:3001:3001"
```

Add the contents of `deploy/nginx-scout-location.conf` inside your existing HTTPS `server` block, before that site's `location /` block:

```nginx
location = /scout {
    return 308 /scout/;
}

location ^~ /scout/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 5s;
    proxy_read_timeout 60s;
}
```

The `proxy_pass` intentionally has no trailing slash, so the Express application receives the required `/scout` prefix. These are Nginx directives, not shell commands.

## Quick start: mock mode

Mock mode is the recommended first deployment and needs no Google project.

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:3001/scout/health
```

Before editing Nginx, make a backup outside `sites-enabled` (Nginx loads every file in that directory):

```bash
sudo install -d -m 0750 /etc/nginx/backups
sudo cp --dereference /etc/nginx/sites-enabled/<your-site> \
  "/etc/nginx/backups/<your-site>.$(date +%Y%m%d-%H%M%S)"
sudoedit /etc/nginx/sites-enabled/<your-site>
```

Insert the two location blocks above inside the `listen 443 ssl` server. Validate before reloading:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Only run the reload if `nginx -t` reports that the configuration syntax is OK. Then open `https://<your-server>/scout/`.

`docker compose down` preserves the `sc_data` monthly usage counter. Do not add `--volumes` unless you intentionally want to delete that safety counter.

### Verification checklist

Run these on the host after deployment:

```bash
docker compose ps
docker inspect --format '{{.State.Health.Status}}' sc_app
curl http://127.0.0.1:3001/scout/health
curl -k https://127.0.0.1/scout/health
curl -k https://127.0.0.1/scout/api/status
docker compose logs --tail=100 app
```

Expected results are a healthy `sc_app`, `{"ok":true,"mode":"mock"}` for the first deployment, and a status response showing the monthly counter and its 8,000-call safety limit. From another device on the network, open `https://<your-server>/scout/` to verify firewall and network access.

Nginx keeps using its own certificate and key. SCOUT never mounts or reads those files.

## Obtain and configure the Google credentials

You do not submit a special preview-access form in the current setup flow. Google currently directs users to enable the Isochrones API in a normal billed Google Cloud project and authenticate with an API key or OAuth token. These steps use two API keys so browser access cannot expose the server credential.

### 1. Create the project and enable billing

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a dedicated project, for example `scout`.
3. Attach a billing account. Google requires billing even while Isochrones Preview usage is priced at $0 or usage remains within a free allowance.
4. In **APIs & Services → Library**, enable:
   - **Maps JavaScript API**
   - **Places API (New)**
   - **Isochrones API**

Activation can take several minutes.

### 2. Create the browser key

1. Go to **APIs & Services → Credentials → Create credentials → API key**.
2. Name it `scout-browser`.
3. Under **Application restrictions**, choose **Websites**.
4. Authorize the HTTPS origin SCOUT is served from, for example `https://<your-server>`. Use origin-level authorization rather than depending on `/scout/*`; browsers commonly omit paths from cross-origin referrers.
5. Under **API restrictions**, allow only **Maps JavaScript API** and **Places API (New)**.
6. Put it in `.env` as `GOOGLE_MAPS_BROWSER_KEY=...`.

This key is visible in browser network tools. That is normal for Maps JavaScript. Restrictions, quotas, and optionally Maps JavaScript API App Check protect it; secrecy cannot.

### 3. Create the Isochrones server key

1. Create a second API key named `scout-isochrones-server`.
2. Under **API restrictions**, allow only **Isochrones API**.
3. If the server has a stable public egress IP, add an **IP addresses** application restriction for that public/NAT address, not the server's private LAN address, because Google sees the public source address. If the public IP changes, this restriction will interrupt service.
4. Save the key to `secrets/isochrones_key.txt`, with no surrounding quotes:

```bash
mkdir -p secrets
nano secrets/isochrones_key.txt
chmod 600 secrets/isochrones_key.txt
```

The `secrets/` directory and key/certificate patterns are excluded from both Git and the Docker build context.

### 4. Enable live mode

Set the browser key in `.env`, then start with the live overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.live.yml up -d --build
```

Confirm that `https://<your-server>/scout/health` returns JSON with `"mode":"live"`. The status endpoint intentionally reports whether configuration exists but never returns the server key.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASE_PATH` | `/scout` | Public application base path; the supplied image is built for this path. |
| `USE_MOCK_DATA` | `true` | Uses bundled fixture polygons and makes no Isochrones calls. |
| `GOOGLE_MAPS_BROWSER_KEY` | empty | Browser Maps/Places key; visible to browsers. |
| `GOOGLE_ISOCHRONES_SERVER_KEY_FILE` | unset | Docker secret path used by the live overlay. |
| `TRAFFIC_CACHE_MINUTES` | `15` | Cache lifetime for providers whose terms permit result caching (mock mode today). |
| `STATIC_CACHE_DAYS` | `7` | Long cache lifetime for providers whose terms permit it (mock mode today). |
| `RATE_LIMIT_PER_MINUTE` | `30` | Requests accepted per client IP per minute. |
| `MAX_EXTERNAL_CALLS_PER_HOUR` | `60` | Hard local circuit breaker for Google cache misses. |
| `MAX_EXTERNAL_CALLS_PER_DAY` | `200` | Durable daily stop, reset at 00:00 UTC. |
| `MAX_EXTERNAL_CALLS_PER_MONTH` | `8000` | Durable monthly stop with 20% headroom below the 10,000-request allowance. |
| `USAGE_BUDGET_FILE` | unset locally | JSON counter path; Compose sets `/app/data/google-call-budget.json` on `sc_data`. |
| `SC_HTTP_PORT` | `3001` | Loopback-only host port used by the host's Nginx. |
| `PORT` | `3001` in Compose | HTTP listener inside `sc_app`. |
| `HTTPS_ENABLED` | `false` in Compose | Nginx owns HTTPS; SCOUT uses internal HTTP. |
| `TRUST_PROXY` | `true` in Compose | Trusts the single local Nginx hop for client-IP rate limiting. |

The cache is intentionally in-memory. Restarting the container clears route results, but browser settings and presets remain in each browser's local storage. Completed Google polygon responses are not inserted into it under the current Isochrones policy; only identical requests already in progress are deduplicated.

## Local development on Windows

PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173/scout/`. The development server proxies API calls to the local Express process on port 3001. Mock mode is used by default.

Useful commands:

```powershell
npm run test
npm run typecheck
npm run build
$env:NODE_ENV='production'; $env:HTTPS_ENABLED='false'; $env:PORT='3001'; npm start
```

The production build is then available at `http://localhost:3001/scout/` for local verification. Docker is the intended HTTPS production runtime.

## Cost controls and quotas

SCOUT minimizes accidental use by design:

- It never calls Isochrones while typing or changing controls.
- A deliberate Generate action is required.
- The UI reports the maximum request count before cache reuse: destinations × three bands.
- Identical requests share a single in-flight promise. Mock and future terms-compatible providers then use a TTL cache.
- Completed Google polygon responses are deliberately not cached because the current [Isochrones policy](https://developers.google.com/maps/documentation/isochrones/policies) exempts Place IDs, not polygon content, from Google's caching restrictions.
- The API accepts one validated isochrone request, not arbitrary Google URLs or payloads.
- A per-IP minute limit and the global `MAX_EXTERNAL_CALLS_PER_HOUR` circuit breaker apply even if a LAN browser scripts the local endpoint.
- Persistent `MAX_EXTERNAL_CALLS_PER_DAY=200` and `MAX_EXTERNAL_CALLS_PER_MONTH=8000` stops prevent a one-day loop and leave at least 2,000 Isochrones requests of headroom below the 10,000-request free usage cap. The counters are written before a Google request and survive container rebuilds in `sc_data`.
- Five destinations and three bands cap a normal calculation at 15 requests.
- The session counter shows actual external cache-miss calls returned by the backend.

Google describes 10,000 Isochrones calls as a **free usage cap**, not as an automatic stop. The documented API quota is 600 requests per minute per project. In Google Cloud, lower that quota to an amount appropriate for personal use, review Maps JavaScript and Places quotas separately, and create billing-budget alerts. **Billing alerts notify; they do not stop charges.** SCOUT's hourly/daily/monthly circuit breakers are the hard stopping mechanisms for server-side Isochrones calls.

Maps JavaScript map loads and Places requests are sent directly by the browser and are separate billable SKUs, each with its own free usage cap. SCOUT cannot authoritatively count or stop those Google-side events. Put the browser key in a dedicated SCOUT project, restrict it to SCOUT's origin and only Maps JavaScript API plus Places API (New), and set the lowest Cloud quotas that still make the application usable. For an absolute application-wide guarantee of zero Google charges, keep `USE_MOCK_DATA=true` and omit `GOOGLE_MAPS_BROWSER_KEY`; live Google Maps/Places cannot provide that guarantee solely through local code.

To keep each place selection on the lower Place Details Essentials SKU, SCOUT requests only `id`, `formattedAddress`, and `location`. The destination name is reused from the autocomplete prediction; SCOUT deliberately does not request `displayName`, which Google classifies as Place Details Pro.

The backend has no user login because network access control is the intended authorization boundary. Anyone who can reach the server on the LAN can call the narrowly validated local endpoint, subject to the local limits. If that trust model changes, add authentication before exposing the endpoint beyond the protected network.

## Current Google contract implemented

- `POST https://isochrones.googleapis.com/v1/isochrones:generate`
- Authentication header: `X-Goog-Api-Key`
- Origin: `place: "places/PLACE_ID"` or a WGS84 `location`
- Modes: `DRIVE`, `WALK`, `BICYCLE`
- Directions: `TO`, `FROM`
- Routing: `TRAFFIC_UNAWARE`, or `TRAFFIC_AWARE` for current/live conditions
- Fidelity: `LOW`, `MEDIUM`, `HIGH`
- Output: RFC 7946 geometry at `isochrone.geoJson`
- Maximum duration: 60 minutes for driving; 120 minutes overall for walking/bicycling

SCOUT never labels live traffic as a historical average or future forecast.

## Testing

```bash
npm install
npm test
npm run build
```

The suite covers duration mapping, ordered band validation, Zod request validation, deterministic cache keys, permitted-provider cache expiration, in-flight deduplication, Google request mapping, mock provider output, Polygon/MultiPolygon intersection and union, empty intersection handling, localStorage serialization, adding a destination, editing a band, mock generation, and the empty-intersection message.

## Troubleshooting

### Docker reports that loopback port 3001 is allocated

Check it with `sudo ss -ltnp 'sport = :3001'`. If necessary, set `SC_HTTP_PORT=3002` in `.env` and change the Nginx `proxy_pass` to `http://127.0.0.1:3002`. Do not change SCOUT's internal `PORT=3001`.

### Browser rejects the certificate

SCOUT is served with the host Nginx site's certificate. Trust that certificate's issuer on the client device. SCOUT does not need its own certificate in this deployment.

### Map says "for development purposes only" or fails to load

Verify billing, Maps JavaScript API enablement, the browser key, and its website/API restrictions. Browser referrer authorization must match the origin. Check the browser console for Google's specific error code.

### Search does not appear

Enable **Places API (New)** on the browser key's project and API restrictions. SCOUT uses the new widget and requests only ID, formatted address, and location after selection. It reuses the prediction text for the display name to avoid the Place Details Pro SKU.

### Isochrones returns configuration errors

Confirm the separate server key is in the secret file, Isochrones API is enabled, billing is attached, and the key permits only that API. If using an IP restriction, confirm the server's current public egress address.

### Empty or missing polygons

The point can be too far from the supported road network for the selected mode, or high fidelity can expose holes in sparse road networks. Partial successes remain visible. Try a nearby place, lower fidelity, a longer duration, or Individual mode.

### "No shared area" appears

The intersection is genuinely empty for at least one band. Increase that duration or use Any/Individual mode. This is not treated as a provider failure.

### Hourly safety limit reached

Wait for the rolling one-hour window or deliberately change `MAX_EXTERNAL_CALLS_PER_HOUR`. Cached results remain usable during the limit.

### Daily safety limit reached

The durable counter reached 200 external attempts in the current UTC day. Wait until 00:00 UTC or deliberately change `MAX_EXTERNAL_CALLS_PER_DAY` after reviewing Google Cloud usage. Do not delete `sc_data` to bypass the safety stop.

### Monthly safety limit reached

The durable counter reached 8,000 external attempts in the current UTC calendar month. Wait for the next month. Raise `MAX_EXTERNAL_CALLS_PER_MONTH` only after reviewing the Google Cloud usage dashboard; keep it below Google's 10,000-request free usage cap. Do not delete `sc_data` to bypass the safety stop.

## Provider extension

`IsochroneProvider` exposes one `generateIsochrone(request)` method. A future provider can implement the shared request/result contract, normalize its geometry to RFC 7946 Polygon or MultiPolygon, and be selected in server configuration. Mapbox, OpenRouteService, or a self-hosted routing engine can therefore be added without changing the UI's geometry, result, or persistence code. No second paid provider is included now.

## Project structure

```text
client/
  src/
    components/       destination search, map, presets
    mock/             Austin sample destinations
    services/         local API and Google loader
    utils/            geometry, settings, persistence
server/
  src/
    cache/            cache interface, memory cache, keys
    providers/        provider interface, mock, Google
    services/         caching, deduplication, safety budget
shared/               contracts, schemas, defaults
scripts/              container TLS entrypoint
Dockerfile
docker-compose.yml
docker-compose.live.yml
deploy/nginx-scout-location.conf
```

## Security notes

- The image runs as a non-root user with a read-only root filesystem, all Linux capabilities dropped, `no-new-privileges`, bounded logs, and only a small temporary filesystem.
- The server credential is injected as a Docker secret file in live mode and never enters an image layer or frontend bundle.
- Raw Google errors are not relayed to users or logs, and credentials are never logged.
- Request JSON is size-limited and Zod-validated; driving traffic rules and duration limits are enforced server-side.
- Google recommends authentication for public proxy endpoints. This installation deliberately substitutes a private network access boundary plus strict request validation and rate/call limits. Do not expose it to the internet in that form.

## License

Application code is provided for personal local use. Third-party packages retain their respective open-source licenses. Google Maps Platform services and returned data remain governed by Google's terms and attribution requirements.
