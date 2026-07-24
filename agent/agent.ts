import { defineAgent, defineDynamic } from "eve";

import { DEFAULT_MODEL_ID, isModelId } from "@/lib/models";

export default defineAgent({
  model: defineDynamic({
    fallback: DEFAULT_MODEL_ID,
    events: {
      "turn.started": (_event, ctx) => {
        const model = ctx.session.auth.current?.attributes.model;
        if (!isModelId(model)) return null;
        return model;
      },
    },
  }),
  limits: {
    maxInputTokensPerSession: 200_000,
    maxOutputTokensPerSession: 75_000,
  },
});
