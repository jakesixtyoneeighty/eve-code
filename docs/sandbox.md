# Vercel Sandbox mechanics

Project-specific facts verified against real sandboxes with `@vercel/sandbox`.
The current adapters rely on these behaviors.

## Ports and public URLs

```ts
const sandbox = await Sandbox.create({ ports: [3000, 3001], ... });
sandbox.domain(3000); // "https://sb-<subdomain>.vercel.run"
```

- Up to 4 ports per sandbox. Each port gets its own opaque subdomain.
- `domain(port)` throws for ports not in the create/update config.
- Ports can also be added later with `sandbox.update({ ports })`. `start_dev` uses
  this to expose the port selected by the model before it launches the server.
- URLs are stable across stop and resume.
- `start_dev` probes the public URL for up to 45 seconds while watching for early
  process exit. An unreachable server is stopped so its port does not block a
  corrected retry, and bounded stdout/stderr are returned to the agent for diagnosis.

## Resolving the URL from Eve

Eve's `SandboxSession` handle exposes no routes. The Vercel backend names each
sandbox with Eve's session key, surfaced as `SandboxSession.id`, and the SDK
supports lookup by name:

```ts
const eveSandbox = await ctx.getSandbox();
const vercelSandbox = await Sandbox.get({ name: eveSandbox.id, resume: false });
await vercelSandbox.update({ ports: [port] });
const url = vercelSandbox.domain(port);
```

Only boundaries that need SDK-only operations touch `@vercel/sandbox` directly:
`start_dev`, Preview control, interruptible Bash, and the workspace channel.

## Traffic

- HTTP through the public URL works; a Vite dev server serves normally with
  `server: { host: "0.0.0.0", allowedHosts: true, hmr: { protocol: "wss", clientPort: 443 } }`.
- WebSocket upgrades work through the public URL, including Vite HMR over `wss://`.

## Stop / resume

- Stopping captures a snapshot; `Sandbox.get({ name, resume: true })` restores it.
- **The filesystem survives completely** — including `node_modules`.
- **Processes do not survive.** Anything spawned (dev server, helper servers) is
  gone after a resume.

The session header polls the sandbox status through the Eve service. Preview can stop
the VM, then resume it and restart the latest `start_dev` command. It does not
supervise or restore any other process.
