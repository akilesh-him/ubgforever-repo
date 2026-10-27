# Slipstream

A games, web apps and proxied browsing portal, based on UBGForever. The original game provider, favorites, recents and profile data remain compatible.

## Local development

Requires Node 22.

```sh
npm install
cp .env.example .env
npm start
```

Open http://localhost:5186/. Set the server-only `OPENROUTER_API_KEY` in `.env` to enable AI. Keep `.env` private. The frontend contains no OpenRouter key.

```sh
npm test
npm run build
```

The build checks JavaScript syntax and copies public assets to `dist/`. AI and Wisp require the Node server. A static upload alone is insufficient.

## Contributing

Read [the development guide](docs/DEVELOPING.md) for module ownership, app/game extension recipes, styling and behavioral tests.

The frontend uses plain JavaScript. Each new lifecycle has a specific owner rather than being spread across the original router. Partner styling lives in `css/slipstream.css`, layered over the original `css/app.css`. The opening screen is separate.

## Features and services

- Original games catalog with local cover mappings and a local Wispcraft client.
- Curated apps in independent app-style windows, plus a local HTML editor.
- Scramjet and BareMux/Epoxy through `/wisp/`, with Startpage search.
- OpenRouter `dots-studio/dots-3-note-preview:free`, image/text attachments, Wikipedia and web search.
- Device-local profile and history, existing community chat, optional opt-in top-ten leaderboard.

Leaderboard SQL is in `supabase-leaderboard.sql`. It is supplied for manual application to the partner project. Browser-local XP is not authenticated competitive scoring, and local profile uploads are not public avatar hosting. Third-party sign-in, streaming and DRM depend on the service.

## Attribution

Game cover provenance is recorded in `tools/artwork-sources.json`. App logo sources are in `img/apps/SOURCES.md`. Wispcraft and its base client are documented in `apps/wispcraft/SOURCES.txt`. Opening assets are documented in `img/landing/SOURCES.txt`.

Local preview work is authorized. Push, merge, deployment and database migrations still require the user's explicit go.

## Azion deployment

See [the Azion guide](docs/AZION.md) for the configuration generator, containerized Node origin and required WebSocket Proxy setup. Static hosting alone cannot run AI or Wisp.
