import { Sandbox } from "@vercel/sandbox";
import { defineTool } from "eve/tools";

import { verifyPreviewProcess } from "@/agent/lib/preview";
import { previewOutputSchema, previewRunSchema } from "@/lib/preview";

export default defineTool({
  description:
    "Start a development server and verify its public sandbox preview. Failed startup returns bounded stdout and stderr so you can fix the cause and retry.",
  inputSchema: previewRunSchema,
  outputSchema: previewOutputSchema,
  async execute({ command, port }, ctx) {
    const session = await ctx.getSandbox();
    const sandbox = await Sandbox.get({ name: session.id, resume: false, signal: ctx.abortSignal });
    await sandbox.update({ ports: [port] }, { signal: ctx.abortSignal });
    const server = await session.spawn({ command });
    const url = sandbox.domain(port);
    await verifyPreviewProcess(server, url, port, ctx.abortSignal);
    return { sandboxId: session.id, url };
  },
});
