import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";

type GenerateScriptInput = {
  tweaks: Record<string, boolean>;
  nvidiaPreset?: string;
};

export function useGenerateScript() {
  return useMutation({
    mutationFn: async (data: GenerateScriptInput) => {
      const validated = api.script.generate.input.parse(data);
      const res = await fetch(api.script.generate.path, {
        method: api.script.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      
      if (!res.ok) {
        throw new Error("Failed to generate optimization script");
      }
      
      return api.script.generate.responses[200].parse(await res.json());
    },
  });
}
