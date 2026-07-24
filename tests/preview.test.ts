import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyPreviewProcess, waitForPreview } from "@/agent/lib/preview";

const encoder = new TextEncoder();

function outputStream(output = ""): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      if (output) controller.enqueue(encoder.encode(output));
      controller.close();
    },
  });
}

function pendingOutputStream(): ReadableStream<Uint8Array> {
  return new ReadableStream();
}

function abortableFetch(_input: unknown, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
      once: true,
    });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("preview", () => {
  it("accepts a reachable public URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ready")));

    await expect(waitForPreview("https://preview.test", 5173)).resolves.toBeUndefined();
  });

  it("rejects a server that is not publicly reachable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 502 })));

    const result = expect(waitForPreview("https://preview.test", 5173)).rejects.toThrow(
      "within 45 seconds",
    );
    await vi.runAllTimersAsync();
    await result;
  });

  it("waits for a slow server without killing it", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 502 }))
        .mockResolvedValueOnce(new Response("ready")),
    );
    const kill = vi.fn().mockResolvedValue(undefined);
    const process = {
      kill,
      stderr: pendingOutputStream(),
      stdout: pendingOutputStream(),
      wait: vi.fn(() => new Promise<{ exitCode: number }>(() => undefined)),
    };

    const result = verifyPreviewProcess(process, "https://preview.test", 5173);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBeUndefined();
    expect(kill).not.toHaveBeenCalled();
  });

  it("returns startup logs when the server exits early", async () => {
    vi.stubGlobal("fetch", vi.fn(abortableFetch));
    const kill = vi.fn().mockResolvedValue(undefined);
    const process = {
      kill,
      stderr: outputStream("Error: missing DATABASE_URL\n"),
      stdout: outputStream("Starting application\n"),
      wait: vi.fn().mockResolvedValue({ exitCode: 1 }),
    };

    await expect(verifyPreviewProcess(process, "https://preview.test", 3000)).rejects.toThrow(
      /exited with code 1[\s\S]*missing DATABASE_URL[\s\S]*Starting application[\s\S]*Next\.js accepts -H 0\.0\.0\.0/,
    );
    expect(kill).toHaveBeenCalledOnce();
  });

  it("kills an unreachable server and returns its startup logs", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 502 })));
    const kill = vi.fn().mockResolvedValue(undefined);
    const process = {
      kill,
      stderr: outputStream("Blocked host: preview.test\n"),
      stdout: outputStream("Local: http://localhost:5173\n"),
      wait: vi.fn(() => new Promise<{ exitCode: number }>(() => undefined)),
    };

    const result = expect(
      verifyPreviewProcess(process, "https://preview.test", 5173),
    ).rejects.toThrow(
      /within 45 seconds[\s\S]*Blocked host: preview\.test[\s\S]*Local: http:\/\/localhost:5173/,
    );
    await vi.runAllTimersAsync();
    await result;

    expect(kill).toHaveBeenCalledOnce();
  });
});
