import { z } from "zod";
import { insertPresetSchema, presets, startupApps, optimizations } from "./schema";
export type { InsertPreset } from "./schema";

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
    delete: {
      method: "DELETE" as const,
      path: "/api/presets/:id" as const,
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
      },
    },
  },
  startup: {
    list: {
      method: "GET" as const,
      path: "/api/startup" as const,
      responses: {
        200: z.array(z.custom<typeof startupApps.$inferSelect>()),
      },
    },
    toggle: {
      method: "PATCH" as const,
      path: "/api/startup/:id" as const,
      input: z.object({ isEnabled: z.boolean() }),
      responses: {
        200: z.custom<typeof startupApps.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  system: {
    stats: {
      method: "GET" as const,
      path: "/api/system/stats" as const,
      responses: {
        200: z.object({
          cpu: z.number(),
          gpu: z.number(),
          memory: z.number(),
          os: z.string(),
        }),
      },
    }
  },
  optimizations: {
    list: {
      method: "GET" as const,
      path: "/api/optimizations" as const,
      responses: {
        200: z.array(z.custom<typeof optimizations.$inferSelect>()),
      },
    },
    toggle: {
      method: "PATCH" as const,
      path: "/api/optimizations/:id" as const,
      input: z.object({ isApplied: z.boolean() }),
      responses: {
        200: z.custom<typeof optimizations.$inferSelect>(),
        404: errorSchemas.notFound,
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
