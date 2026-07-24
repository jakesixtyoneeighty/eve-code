# eve-code

An open-source coding agent built with [Eve](https://eve.dev) and Vercel Sandbox.

Eve Code is a compact reference implementation that demonstrates how to build a
browser-based coding agent with Eve. It combines Eve's durable sessions and
streaming with isolated Vercel Sandboxes, Convex persistence, and a small web
interface around the core coding loop. Web projects run directly from the sandbox
with a live preview and hot reload. The codebase stays deliberately small so its
model, instructions, tools, and interface can be understood and adapted.

> [!WARNING]
> Eve Code is an unauthenticated reference implementation, not a hosted multi-user
> product. In a public deployment, every visitor can access the shared sessions and
> workspaces. Sandbox preview URLs are also public and unauthenticated. Do not use
> private code, credentials, secrets, or sensitive data without first adding the
> necessary security boundaries.

## Features

- 🛠️ Build projects in an isolated, persistent Vercel Sandbox, starting from an
  empty workspace or a public GitHub repository.
- 💾 Conversations are durable and real-time: active turns stream from Eve, while
  completed turns synchronize through Convex.
- 👀 Reasoning and tool calls appear as individual activities, with elapsed time
  and live command output.
- 📝 File edits render as readable diffs with addition and deletion counts.
- 🌐 Run web projects on a live preview URL with hot reload, and restore the
  server after the sandbox goes idle.
- 🗂️ Navigate the workspace and inspect syntax-highlighted source files.

## How it works

The browser connects to an Eve channel, which runs one durable agent session in
its own persistent Vercel Sandbox. The agent uses Eve's file and search tools plus
small local adapters for interruptible commands, diff-producing edits, repository
cloning, and live previews. Eve streams its reasoning, messages, and tool activity
throughout the turn.

An Eve hook saves each completed turn to Convex, even if the browser disconnects.
While a turn is running, the browser follows Eve's live stream; when it finishes,
the Convex checkpoint becomes the durable history and synchronizes every open
client. The workspace browser, command logs, and preview controls all connect to
the same sandbox, so every surface reflects the environment the agent is using.

## Security and scope

Eve Code intentionally leaves authentication, session ownership, quotas, and pull
request workflows out of scope:

- A publicly reachable deployment has no user isolation. Conversations and
  workspace files are shared with anyone who can access the app.
- Starting a preview exposes the selected sandbox port through a public,
  unauthenticated URL. Anyone with that URL can access everything the development
  server makes available.
- A Vercel Sandbox isolates code execution from the host. It does not make the
  preview private or provide access control between visitors.

Keep deployments private and use only non-sensitive code until authentication,
authorization, ownership, and preview protection are implemented. These boundaries
can be added by applications that use Eve Code as a starting point.

## Run locally

Install the dependencies and connect the project to Vercel and Convex:

```bash
bun install
bunx vercel link
bunx vercel integration add convex
bunx vercel env pull .env.local
bun run dev
```

Set `TRANSCRIPTION_AI_GATEWAY_API_KEY` in `.env.local` to enable voice input.
Eve continues to use Vercel OIDC, independently from this key.

Open [http://localhost:5173](http://localhost:5173).

## Deploy

Push a branch or run `bunx vercel deploy`. The Convex integration provides the
deploy keys, and `vercel.json` deploys the Vite app and Eve service with an
isolated Convex deployment for each preview.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the system map, ownership boundaries,
and dependency rules.

## License

[MIT](./LICENSE)
