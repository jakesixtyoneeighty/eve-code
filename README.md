# eve-code

An open-source coding agent built with [Eve](https://eve.dev) and Vercel Sandbox.

<p align="center">
  <img
    src="https://github.com/user-attachments/assets/9e8d2f8b-6910-43e6-9392-61cd618badcb"
    alt="Eve Code demo"
    width="900"
  >
</p>

Eve Code is an open-source coding agent for building software in the browser. It
combines Eve with isolated Vercel Sandboxes, Convex persistence, and a small web
interface around the core coding loop. Web projects run directly from the sandbox
with a live preview and hot reload. The codebase stays deliberately small and can
be used as a starting point for building your own coding agent with Eve.

> [!WARNING]
> Eve Code does not yet implement authentication or user isolation. Use it with
> caution until those boundaries are in place. Every visitor to a public deployment
> can access the shared sessions and workspaces, and sandbox preview URLs are public
> and unauthenticated. Do not use private code, credentials, secrets, or sensitive
> data before implementing the necessary security boundaries.

## Features

- **A fully visible coding loop:** Watch tool calls, live shell output, and file
  diffs as the agent works.
- **Live previews with HMR:** Open the app directly from Vercel Sandbox and see
  every change instantly.
- **Built-in workspace browser:** Navigate the file tree and inspect the source
  without leaving the chat.
- **Durable, real-time sessions:** Conversations synchronized across clients.
- **Model selection:** Switch models from the composer.
- **Voice input:** Real-time transcriptions using AI SDK.
- **Start fresh or from GitHub:** Begin with an empty workspace or a public
  repository.

## Roadmap

- Authentication and personal workspaces for multi-user deployments.
- GitHub integration for private repositories and pull request workflows.
- In-browser file editing.

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
