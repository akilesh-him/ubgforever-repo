# Running Slipstream behind Azion

Slipstream uses an Azion Application and HTTPS connector in front of its Node 22 server. This preserves `/api/ai`, `/game-proxy`, `/wisp/`, service workers and the existing public asset paths. Uploading `dist/` to static storage alone does not run these services. No frontend URL changes are needed.

## 1. Run the origin

Run the repository on a Node host with a publicly reachable HTTPS hostname, such as `origin.example.com`. This must be a different hostname from the public Azion site to avoid a forwarding loop. Its TLS certificate must cover that hostname. The HTTPS reverse proxy at the origin must preserve WebSocket upgrades and allow AI requests to run for at least 120 seconds.

An optional container is included:

```sh
docker build -t slipstream .
docker run --env-file .env -e HOST=0.0.0.0 -e PORT=8080 -p 127.0.0.1:8080:8080 slipstream
```

Put your HTTPS reverse proxy in front of port 8080. The container does not provide TLS itself. Without Docker, use `npm ci --omit=dev` and `npm start` with the same environment settings.

Set these on the origin, never in public frontend files:

```dotenv
GROQ_API_KEY=your-server-only-key
PUBLIC_ORIGINS=https://your-public-domain.example
```

`PUBLIC_ORIGINS` accepts comma-separated exact origins, including the Azion-generated domain if used. Update it and restart the origin after obtaining that domain. Paths, credentials and wildcards are rejected. Requests without an Origin header remain supported for non-browser clients. This is an origin check, not authentication.

## 2. Generate and apply the Azion configuration

Install the official Azion CLI and authenticate to your account. From the repository root:

```sh
npm run config:azion -- https://origin.example.com
azion config apply --config-file azion.config.json
```

Review the generated file before applying. This provisions named `slipstream` resources, so use a separate project/account namespace or rename resources if those names already exist. The generated deployment file is ignored by Git. It contains the origin hostname, never API keys.

The API v4 configuration creates an HTTPS connector, an Application with Application Accelerator enabled, a catch-all request rule and a workload. Configure the desired public domain and certificate in Azion Console, then add that exact HTTPS origin to `PUBLIC_ORIGINS` on the Node host.

## 3. Enable WebSocket Proxy

Enable **WebSocket Proxy** for this Application in Azion Console. The account must have access to this feature. Preserve the `/wisp/` path and upgrade headers. Without it, the frontend can load while Browser and external apps fail to connect. The configuration generator does not claim to enable this account-level capability.

Edge caching is disabled initially for correctness. Do not cache `/api/ai`, `/game-proxy`, `/wisp/` or `/sw.js` when adding caching rules later. Preserve query strings and allow POST requests. Allow request bodies of at least 8 MB for AI attachments.

The existing AI rate limiter uses the origin socket address. Behind Azion this can group visitors under a shared edge address and apply the ten-requests-per-minute limit collectively. Forwarded IP headers are deliberately not trusted. For a larger deployment, configure trusted proxy validation and per-user limits before opening AI to heavy public use.

## Verification

- Open the public HTTPS site and enter through Menu.
- Confirm game artwork and a game load.
- Open Browser and navigate to a site. In developer tools, `/wisp/` must receive a WebSocket 101 response.
- Send an AI message and attachment. A 403 indicates a missing public origin. A 503 indicates the origin key is not configured.
- Reload and confirm `/sw.js` and `/scramjet/` load from the same public domain.
- Check external apps and browser back/forward controls.

Local tests cover configuration generation and allowed origins. They do not verify account entitlements, DNS, TLS or live Azion routing. The container requires a Docker-capable host to build and run.

Official references: [Azion configuration](https://www.azion.com/en/documentation/devtools/cli/azion-config-js/), [WebSocket Proxy](https://assets.azion.com/en/documentation/platform/applications/websocket/), [connectors](https://www.azion.com/en/documentation/platform/connectors/).
