# Travel Planner

Mobile-first on-demand AI travel companion prototype. Core rule: no continuous tracking. User asks for planning, route, timing, and replan help only when needed.

## Run locally

```bash
npm install
npm run dev
```

## Map configuration

Copy `.env.example` to `.env.local` and add provider keys when available.

```bash
VITE_MAP_PROVIDER=google
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
VITE_APPLE_MAPKIT_TOKEN=your_apple_mapkit_jwt
```

Current map foundation supports:

- Google Maps embedded directions when `VITE_GOOGLE_MAPS_API_KEY` is set.
- Google Maps external route links without an API key.
- Apple Maps external route links without an API key.
- Apple MapKit JS readiness state through `VITE_APPLE_MAPKIT_TOKEN`.

## Flight tracking

The app includes flight-aware planning inputs and a provider abstraction in `src/services/flightTracking.ts`.

Current free provider target:

- OpenSky Network REST API: live ADS-B state vectors via `/states/all`.
- Anonymous access is available but rate limited. OpenSky also supports OAuth2 client credentials for higher daily credit quotas.
- Best live lookup key is `icao24`, the aircraft transponder hex code. Airline flight numbers like `DL 123` are accepted by the UI, but reliable flight-number-to-aircraft mapping needs a future provider or backend enrichment.

Current behavior:

- If `icao24` is provided, the app attempts OpenSky live state lookup.
- If live lookup is unavailable, the app keeps a local flight watch and protects arrival buffers in the plan.
- This keeps the UX complete now and leaves the real provider swap isolated to the flight tracking service.

## Next integration steps

1. Add backend endpoint for AI itinerary generation.
2. Store API keys and Apple MapKit JWT signing server-side.
3. Replace demo plan data with planner response DTOs.
4. Add location permission flow around explicit user actions only.
5. Add route ETA, opening hours, and wait-risk data sources.
6. Add flight-number enrichment provider for airline flight lookup.
