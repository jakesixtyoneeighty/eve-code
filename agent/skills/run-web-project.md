---
description: Diagnose and run an existing web project when its development server or public sandbox preview does not start.
---

Inspect before changing anything:

1. Read every applicable `AGENTS.md`, the README, package manifest, lockfiles, framework config,
   and environment examples.
2. Identify the package manager from the lockfile and inspect the available scripts. Work from
   the package containing the web app, not automatically from the repository root.
3. Install dependencies with the repository's package manager. Never replace its lockfile or
   package manager only to make startup easier.
4. Use finite `bash` commands to run the relevant build, typecheck, or framework diagnostic.
   Resolve missing environment variables and generated clients before starting a server.

Call `start_dev` with the real dev command and its exact port. If it fails, treat its captured
stdout and stderr as the primary diagnosis. Fix that error before trying unrelated host settings.

The server must bind to `0.0.0.0`:

- Vite: configure `server.host = "0.0.0.0"` and `server.allowedHosts = true`. For HMR through
  the public route, use `hmr: { protocol: "wss", clientPort: 443 }`.
- Next.js: pass `-H 0.0.0.0 -p <port>` to `next dev`.
- Astro: pass `--host 0.0.0.0 --port <port>` to `astro dev`.
- Other servers: inspect their current CLI help or official configuration and set both host and
  port explicitly.

Useful finite checks include the package-manager build script, framework version command,
`test -f` for expected env files, and `ss -ltnp` after a failed attempt. Do not run servers,
watchers, or REPLs through `bash`.

Once the underlying error is fixed, call `start_dev` again. Do not claim the preview works until
the tool returns its public URL.
