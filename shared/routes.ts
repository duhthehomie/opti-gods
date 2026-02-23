import { z } from "zod";
import { insertPresetSchema, presets } from "./schema";

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  presets: {
    list: {
      method: "GET" as const,
      path: "/api/presets" as const,
      responses: {
        200: z.array(z.custom<typeof presets.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/presets" as const,
      input: insertPresetSchema,
      responses: {
        201: z.custom<typeof presets.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  script: {
    generate: {
      method: "POST" as const,
      path: "/api/script/generate" as const,
      input: z.object({
        tweaks: z.record(z.boolean()),
        nvidiaPreset: z.string().optional(),
      }),
      responses: {
        200: z.object({
          scriptUrl: z.string(),
          command: z.string()
        }),
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
