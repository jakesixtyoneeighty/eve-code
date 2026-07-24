# Architecture

This document is the repository map and architectural guardrail. It describes the
current system, assigns each responsibility to one owner, and defines the dependency
direction that keeps changes small and prevents technical debt.

Read it before changing state ownership, persistence, external boundaries,
dependencies, or code across layers. Update it in the same change when those
boundaries move. This is not a roadmap: speculative work belongs in a focused design
document and enters here only when it becomes part of the implementation.

eve-code is a browser coding agent. A user starts a session, asks an agent to build
something, and watches it work inside a live sandbox.

Three goals rank above every feature:

1. **Showcase Eve.** Use Eve's sessions, sandbox, tools, stream, and hooks. Custom
   code starts where those primitives end.
2. **Stay exemplary and small.** Whoever opens the repository should think “look
   how little it takes.” Clarity is part of the product.
3. **Feel instant.** Render cached state, navigate optimistically, stream work, and
   lazy-load heavy UI.

Few features executed well beat many features.

## System map

```text
Browser (Vite + React)
   │ turns and durable event stream
   ▼
Eve service ───────────────────────▶ Vercel Sandbox
   │ one durable Eve session              │ persistent /workspace
   │ per conversation                      └─ dev server ──▶ Preview URL
   │ checkpoint and Git hooks
   ▼
Convex (sessions, turns) ──▶ subscribed browser cache

Browser ── workspace and preview HTTP ──▶ Eve channels ──▶ same sandbox
```

The HTTP channels are narrow product adapters. Eve still creates the session and
sandbox, runs the agent, serializes turns, and owns the durable event stream.

### Ownership

- **Eve** owns agent sessions, turns, event streaming, tool execution, and the
  session-bound sandbox.
- **Convex** owns the durable product index and compact completed-turn checkpoints.
- **The browser runtime** owns only in-flight events, optimistic input, view state,
  and caches derived from Eve or Convex.
- **Eve channels** expose narrow browser-to-sandbox operations that Eve does not
  provide directly. They do not become a second application backend.
- **Git metadata** describes the repository currently found in a session workspace.
  It does not create a second project or persistence model.

New behavior extends the existing owner. Do not introduce a parallel store, stream,
session model, or sandbox API for the same responsibility.

## Architectural principles

1. **Eve first.** A design built on an Eve primitive wins over a parallel local
   framework.
2. **The session is the unit of work.** It carries conversation state, the sandbox,
   and turn serialization. Repository and branch fields describe its current
   workspace; sessions are not grouped or synchronized through a separate project
   model.
3. **The workspace starts empty.** `agent/sandbox.ts` selects Eve's Vercel backend.
   A repository start asks the agent to clone through `clone_repository`; otherwise
   no framework or seed is installed until the task needs one.
4. **The agent starts with Eve's hands.** `read_file`, `glob`, `grep`, and the other
   built-ins remain framework tools. Narrow local adapters add complete-write diffs,
   exact edits, preview startup, and the Bash gaps described below.
5. **Persistence follows Eve.** The browser consumes the live stream. An Eve hook
   replays each completed turn and commits one compact checkpoint to Convex; the
   browser is never the source of completed-turn truth.
6. **Work stays visible.** Reasoning, tool calls, elapsed time, diffs, and command
   output appear in the conversation. Preview opens the real server URL in a new
   tab; there is no iframe or duplicate log panel.
7. **Security boundaries stay explicit.** The demo has no application identity:
   Convex operations and product channels do not enforce user ownership. Keep any
   deployment private unless authentication, ownership, and cost controls are added
   as one coherent boundary.

## Data model

```text
sessions   sessionId, eveSessionId?, name, continuationToken?,
           repository?, branch?, status { ready | running | stopping | error },
           streamIndex, updatedAt
turns      sessionId, turnId, events, searchText, streamIndex,
           usage { inputTokens, outputTokens }
```

`sessionId` is the app's public route identifier. `eveSessionId` identifies Eve's
durable runtime behind it. The browser creates the public session immediately; Eve
fills its runtime identity and continuation state when the first turn runs.

Eve serializes turns, so there is no application turn lock. The checkpoint hook
stores each turn once at a stream boundary. Preview results, tool calls, and activity
remain in Eve's events instead of becoming parallel Convex records. Token usage is
recorded for future product decisions but does not enforce a product quota; Eve's
per-session safety limits still apply.

The selected model is transient browser state sent with each turn. The Eve channel
validates it into current request attributes, and the agent resolves it at turn scope
with the shared default as fallback. Convex does not persist model selection.

## Coding harness

Eve's built-ins are the base. The local additions are deliberately narrow:

- **`bash`** reuses Eve's built-in contract and replaces only its executor. It runs
  a detached Vercel Sandbox command, waits with the turn's abort signal, kills the
  command on interruption, returns the tail of bounded stdout/stderr, and exposes
  live logs to the active tool activity.
- **`clone_repository`** validates a public GitHub repository, clones it into the
  current workspace, and returns its root entries in the repository activity.
- **`write_file`** preserves Eve's create/overwrite contract and read-before-write
  protection, adding a bounded diff for new files and complete replacements.
- **`edit_file`** applies batched, exact, unique, non-overlapping replacements to one
  snapshot and stores a context-limited unified diff.
- **`start_dev`** starts the model-selected server command, exposes its port, verifies
  the public route for up to 45 seconds, and returns the sandbox ID and URL. It races
  startup against early process exit, captures bounded stdout and stderr, and stops
  an unreachable process so the agent can diagnose the real error and retry cleanly.
- **Instructions** require reading before editing, finite Bash commands, `start_dev`
  for long-lived servers, and a build or test before claiming success.

Add orchestration only when the existing session-and-tool model cannot express a
proven requirement.

## Framework edges and workarounds

The demo keeps each Eve workaround at one boundary. Upstream-facing candidates are
tracked in [docs/eve-improvements.md](./docs/eve-improvements.md).

- Eve 0.24.6 does not propagate cancellation through the built-in Bash wait. The
  local `bash` adapter binds the abort signal and kills the Vercel command so Stop can
  settle the turn.
- Eve can still fail to emit a boundary after cancellation. Stop records a durable
  `stopping` state; Convex releases it as an error after 20 seconds unless a normal
  checkpoint settles it first. An explicit retry clears that error before Eve starts.
- Eve does not include submitted HITL responses in its durable stream. Before resuming,
  the browser appends Eve's `client.input.responded` projection event to the existing
  Convex turn checkpoint so answered questions survive navigation and reload.
- The built-in Bash result arrives after completion. The workspace channel follows
  the active Vercel command's log stream so the conversation can render output while
  it runs.
- Eve's sandbox handle does not expose ports, public URLs, status, stop, or resume.
  `start_dev` and the preview-control channel look up the same sandbox through
  `@vercel/sandbox` only for those operations.
- Sandbox files survive stop and resume; processes do not. Preview therefore stores
  the latest `start_dev` command in Eve's stream and reruns it when the user resumes
  the preview.
- Eve has no browser workspace API. A read-only channel lists files and reads one
  file from `/workspace`; it rejects path traversal and symlink escapes, prunes
  generated directories, caps the tree at 10,000 paths, and refuses binary or text
  files over 200 KiB.

The current workspace routes are:

```text
GET /eve/v1/workspace/:sessionId
GET /eve/v1/workspace/:sessionId/file?path=...
GET /eve/v1/workspace/:sessionId/command
GET /eve/v1/workspace/:sessionId/download
```

Here `sessionId` is Eve's durable session ID, not the app's public session ID.

## Frontend

- **Home** chooses between an empty workspace and a public GitHub repository.
  Repository import is a visible first turn that asks the agent to clone through its
  dedicated tool, so success and failure appear as a repository activity.
  The sidebar lists sessions newest first.
- **Session** renders the durable conversation, Preview control, and a Files toggle.
  Its header shows the selected GitHub repository when the workspace has one.
  The read-only workspace contains breadcrumbs, a keyboard-accessible tree, and a
  highlighted source viewer. File tool activity can open the corresponding file.
- **Composer** composes text input, a turn-scoped model selector, the self-contained
  Chat Voice Input package, and submit as independent controls. Audio is never
  recorded or persisted.
- **Activity** projects Eve events into reasoning, tool calls, live Bash output,
  file diffs, and elapsed time.
- **Session management** includes responsive sidebar navigation, rename, and delete.

The tree refetches after the next Convex checkpoint changes the session stream index.
It intentionally has no watcher yet. Routes are `/` and `/s/:sessionId`.

A dedicated hook checks the workspace for Git at each session boundary. It derives
the GitHub origin and current branch from the sandbox and syncs them to the product
session, whether Git was created from the Home shortcut or by a later agent command.

## Performance

- **Convex is the local cache.** Convex subscriptions feed TanStack Query with an
  infinite stale time; navigation renders cached data and receives updates in place.
- **Creation is optimistic.** The browser creates public IDs and navigates before
  the session mutation settles. When creation includes a first message, it renders
  immediately while the first Eve turn starts.
- **The live path stays live.** Eve streams turns; the workspace channel separately
  streams the active Bash command.
- **Heavy UI is lazy.** File diffs load their renderer only when a diff appears. The
  workspace panel loads on the first Files open and remains mounted while hidden;
  Pierre and Shiki are absent from the initial route and language grammars load on
  demand.
- **Shiki is bounded.** Vite aliases Pierre's generic Shiki entry points to the small
  supported-language map and one dark theme instead of bundling every grammar,
  theme, and WASM engine.
- **Cached workspace data remains visible.** A refresh keeps the last tree or file
  until its replacement arrives.

## Structure and layers

Dependencies point downward. If a lower layer needs a higher one, move the concern
instead of bending the rule. Cross-layer changes must preserve one owner for each
piece of state and one boundary for each external system.

```text
docs/           platform research and upstream notes
agent/          Eve agent and its server-side adapters
  agent.ts  sandbox.ts  instructions.md
  channels/     Eve transport, preview control, read-only workspace and logs
  hooks/        turn checkpoint persistence and Git metadata sync
  lib/          Agent-specific helpers
  skills/       optional stack recipes
  tools/        narrow additions to Eve's built-in tool set
convex/         schema, session operations, and checkpoint persistence
lib/            lowest-level reusable modules and extractable feature packages
  chat-voice-input/
                self-contained voice input package
components/
  app-header.tsx
                shared route header and optional workspace/preview actions
  app-sidebar.tsx
                responsive application navigation and session management
  session-list-item.tsx
                session navigation row, rename, and row actions
  ui/           generic visual primitives
  chat/         reusable chat layout, actions, scrolling, and composition
  code/         lazy Pierre-backed diff facade
  session/      session lifecycle, messages, activity, and preview control
  workspace/    file navigation, tree, queries, source viewer, and panel
app/            routes, pages, providers, and top-level wiring
tests/          pure contract and runtime tests
vercel.json     Vite web service plus Eve service
```

Layer rules:

- `agent/` imports low-level `lib/` contracts and generated Convex APIs, never UI.
- `convex/` imports only pure `lib/` modules.
- `lib/` never imports feature components, `app/`, `agent/`, or `convex/`. An
  extractable feature may own components as long as its directory remains
  self-contained. Modules may be cross-runtime, browser-only, or server-only, but
  filenames and dependencies must make those boundaries obvious.
- External data is validated and normalized at its boundary. Internal consumers
  receive one stable shape instead of repeating defensive parsing.
- Feature components may import `ui/`, `lib/`, generated Convex APIs, and sibling or
  lower feature facades. `app/` wires them together; nothing imports from `app/`.
- Parents compose sibling capabilities and own only the coordination between them.
  Feature components own the behavior named by their boundary and never absorb
  unrelated sibling actions. Removing an optional feature at its composition site
  must leave unrelated workflows intact.
- Vendor renderers stay behind `components/code/` or the workspace feature boundary.
  Consumers do not depend on Pierre directly.
- There are no application barrel files. An extractable package directory may expose
  one public `index.ts` plus explicit runtime subpaths such as `server`; its internal
  imports remain relative so the directory can move unchanged.
- Split on responsibility, not line count. Extract shared code on its second real
  consumer, not in anticipation of one.

## Dependency boundaries

The runtime remains intentionally short:

- `eve`, `@vercel/sandbox`, and `@vercel/oidc` for the agent and sandbox
- `convex`, `@convex-dev/react-query`, and TanStack Query for durable reactive data
- React 19, React Router, and Zustand for the browser runtime
- Tailwind 4, `@shadcn/react`, Lucide, and Streamdown for the interface
- `@pierre/diffs`, `@pierre/trees`, `diff`, and Pierre's transitive Shiki runtime for
  source, diff, and tree rendering
- Zod for HTTP boundary validation

The current product has no browser editor or terminal; agent tools and the read-only
workspace cover that scope without those runtime dependencies. The repository also
avoids a parallel HTTP framework, direct LLM SDKs, and iframe preview infrastructure
because Eve and the platform already provide the needed boundaries.

## Workspace export

Workspace export extends the existing workspace channel instead of introducing a
long-lived sandbox server:

```text
Browser ── Eve workspace route ──▶ Vercel Sandbox ──▶ TAR of /workspace
```

The route creates a temporary archive inside the sandbox, excludes `node_modules`,
and returns the bytes through Eve. It needs no extra port, token, dependency,
or process to restore after resume.

## Upstream and investigation notes

When Eve lacks a needed primitive, keep the local adapter small, document why it
exists, and remove it when Eve gains the capability. Upstream contact goes through
the owner.

Implementation assumptions were checked against Eve 0.24.6 source and real Vercel
Sandboxes. See [docs/sandbox.md](./docs/sandbox.md) and
[docs/eve-improvements.md](./docs/eve-improvements.md).
