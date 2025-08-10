# POI API - Firebase Cloud Functions (v2, Node 20, TypeScript)

Minimal, production-ready server for a travel companion app. Exposes:

- GET `/poi` – returns one recommended place
- GET `/photo` – photo proxy to Google Places Photo API

No frontend is included.

## Tech

- Firebase Functions v2, Node.js 20, TypeScript
- Validation: zod
- Logging: firebase-functions/logger
- HTTP fetch: global WHATWG `fetch` (Node 20)

## Prerequisites

- Node.js 20+
- Google Cloud project with Places API enabled
- Firebase CLI

```bash
npm i -g firebase-tools
firebase login
```

## Project Setup

```bash
firebase init functions   # Choose TypeScript, Node 20 (or skip if repo already initialized)
cd functions
npm i zod node-fetch
cd ..
```

## Secrets

Store the Places API key as a Firebase Functions secret:

```bash
firebase functions:secrets:set PLACES_API_KEY
```

## Local Development (Emulator)

Create an optional `.env` file inside `functions/` to set CORS origin for local dev:

```
ALLOWED_ORIGIN=https://your-frontend.example
```

Then build and start emulators:

```bash
cd functions && npm run build && cd ..
firebase emulators:start
```

Emulator URLs follow the pattern:

- http://127.0.0.1:5001/<project>/us-central1/poi
- http://127.0.0.1:5001/<project>/us-central1/photo

## Deploy

```bash
firebase deploy --only functions
```

## API

### GET /poi

Query params:

- `startLat` (required, number)
- `startLng` (required, number)
- `prompt` (optional, string; e.g., "specialty coffee near Shibuya Station")
- `radius` (optional, number; default 1200 meters)
- `vibe` (optional, string; influences the reason text only)

Behavior:

- Uses Google Places Text Search anchored by `location` and `radius`
- Picks a good result favoring type `cafe` then `restaurant`, high rating, has photos
- Fetches Place Details (name, geometry, photos, summary, reviews, rating)
- Constructs exactly two `images` URLs by calling our `/photo` proxy; duplicates one if only a single photo exists
- `google_map_link` is `https://www.google.com/maps/dir/<startLat>,<startLng>/<destLat>,<destLng>`
- `reason` is built deterministically from editorial summary, rating + count, and top review; optionally appends `Fits your vibe: <vibe>.`
- CORS allows only `http://localhost:5173` and `ALLOWED_ORIGIN` if set
- Robust 400s/404s/500s on invalid inputs, no results, or internal errors

Response shape example:

```json
{
  "title": "string",
  "images": ["string", "string"],
  "google_map_link": "string",
  "reason": "string"
}
```

### GET /photo

Query params:

- `ref` (required, photo_reference)
- `maxwidth` (optional, default 1200)

Behavior:

- Proxies the Google Places Photo API and streams the image back
- Hides the API key from clients

## CORS

Allowed origins are:

- `http://localhost:5173`
- `ALLOWED_ORIGIN` env var (if set)

Set `ALLOWED_ORIGIN` in production via Cloud Functions runtime environment variables (Cloud Console) or locally via `functions/.env`.

## curl examples

```bash
# POI (Shibuya Station as start)
curl -G "http://127.0.0.1:5001/<project>/us-central1/poi" \
  --data-urlencode "startLat=35.658034" \
  --data-urlencode "startLng=139.701636" \
  --data-urlencode "prompt=specialty coffee near Shibuya Station" \
  --data-urlencode "vibe=quiet"

# Photo proxy
curl -G "http://127.0.0.1:5001/<project>/us-central1/photo" \
  --data-urlencode "ref=SOME_PHOTO_REFERENCE" \
  --data-urlencode "maxwidth=1200" \
  -o sample.jpg
```

## Commands (quick reference)

```bash
npm i -g firebase-tools
firebase login
firebase init functions   # TypeScript, Node 20
cd functions
npm i zod node-fetch
firebase functions:secrets:set PLACES_API_KEY
firebase emulators:start
firebase deploy --only functions
```
