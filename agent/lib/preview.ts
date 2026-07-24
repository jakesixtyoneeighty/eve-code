import type { SandboxProcess } from "eve/sandbox";

const previewLogCharactersMax = 6_000;
const previewRequestTimeoutMs = 5_000;
const previewRetryDelayMs = 750;
const previewTimeoutMs = 45_000;

function getAbortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  return new Error("Preview start was aborted.");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "The preview check failed.";
}

async function fetchPreview(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response | undefined> {
  const request = new AbortController();
  const timeout = setTimeout(() => request.abort(), timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, request.signal]) : request.signal;
  try {
    return await fetch(url, { signal: requestSignal });
  } catch {
    if (signal?.aborted) throw getAbortError(signal);
    return;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return;
  }
  if (signal.aborted) throw getAbortError(signal);
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(getAbortError(signal));
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

type OutputTail = {
  read(): string;
  stop(): Promise<void>;
};

function collectOutputTail(stream: ReadableStream<Uint8Array>): OutputTail {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";
  let truncated = false;

  function append(chunk: string): void {
    output += chunk;
    if (output.length <= previewLogCharactersMax) return;
    output = output.slice(-previewLogCharactersMax);
    truncated = true;
  }

  const done = (async () => {
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        append(decoder.decode(next.value, { stream: true }));
      }
      append(decoder.decode());
    } catch {
      // The reader is cancelled once the preview is ready or the process is killed.
    } finally {
      reader.releaseLock();
    }
  })();

  return {
    read() {
      const text = output.trim();
      if (!truncated || !text) return text;
      return `[truncated: showing the last ${previewLogCharactersMax} characters]\n${text}`;
    },
    async stop() {
      await reader.cancel().catch(() => undefined);
      await done;
    },
  };
}

function formatPreviewFailure(
  reason: string,
  port: number,
  stdout: string,
  stderr: string,
): string {
  const sections = [reason];
  if (stderr) sections.push(`Dev server stderr:\n${stderr}`);
  if (stdout) sections.push(`Dev server stdout:\n${stdout}`);
  if (!stderr && !stdout) sections.push("The dev server produced no startup output.");
  sections.push(
    [
      "Fix the startup failure, then call start_dev again:",
      "- Use bash for finite diagnostics such as dependency installation, build, typecheck, and port checks.",
      `- Make the server listen on 0.0.0.0 and the exact port ${port}.`,
      "- Vite also needs server.allowedHosts: true; Next.js accepts -H 0.0.0.0; Astro accepts --host 0.0.0.0.",
      "- Check the project manifest, lockfile, working directory, required environment variables, and the logs above.",
    ].join("\n"),
  );
  return sections.join("\n\n");
}

export async function waitForPreview(
  url: string,
  port: number,
  signal?: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + previewTimeoutMs;
  while (Date.now() < deadline) {
    const remainingMs = deadline - Date.now();
    const response = await fetchPreview(
      url,
      Math.min(previewRequestTimeoutMs, remainingMs),
      signal,
    );
    if (response && response.status !== 403 && response.status !== 502) return;
    const retryDelayMs = Math.min(previewRetryDelayMs, deadline - Date.now());
    if (retryDelayMs > 0) await waitForRetry(retryDelayMs, signal);
  }
  throw new Error(
    `Preview was not publicly reachable on port ${port} within ${previewTimeoutMs / 1_000} seconds.`,
  );
}

type PreviewProcess = Pick<SandboxProcess, "kill" | "stderr" | "stdout" | "wait">;

type PreviewOutcome =
  | { readonly type: "ready" }
  | { readonly exitCode: number; readonly type: "exit" };

export async function verifyPreviewProcess(
  process: PreviewProcess,
  url: string,
  port: number,
  signal?: AbortSignal,
): Promise<void> {
  const stdout = collectOutputTail(process.stdout);
  const stderr = collectOutputTail(process.stderr);
  const preview = new AbortController();
  const previewSignal = signal ? AbortSignal.any([signal, preview.signal]) : preview.signal;
  let failure: unknown;
  let outcome: PreviewOutcome | undefined;

  try {
    outcome = await Promise.race([
      waitForPreview(url, port, previewSignal).then((): PreviewOutcome => ({ type: "ready" })),
      Promise.resolve(process.wait()).then(
        ({ exitCode }): PreviewOutcome => ({ exitCode, type: "exit" }),
      ),
    ]);
  } catch (error) {
    failure = error;
  }

  preview.abort();
  const ready = outcome?.type === "ready" && !signal?.aborted;
  if (!ready) await Promise.resolve(process.kill()).catch(() => undefined);
  await Promise.all([stdout.stop(), stderr.stop()]);

  if (ready) return;
  if (signal?.aborted) throw getAbortError(signal);

  const reason =
    outcome?.type === "exit"
      ? `Dev server exited with code ${outcome.exitCode} before the preview became reachable.`
      : getErrorMessage(failure);
  throw new Error(formatPreviewFailure(reason, port, stdout.read(), stderr.read()));
}
