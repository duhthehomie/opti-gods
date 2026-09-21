import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { getTweakRelevance } from "@/lib/hardware-optimization";
import { useHardwareInfo } from "./use-hardware-info";
import { getStoredToken } from "@/lib/pro-status";

type GenerateScriptInput = {
  tweaks: Record<string, boolean>;
  nvidiaPreset?: string;
};

export function useGenerateScript() {
  const hw = useHardwareInfo();
  
  return useMutation({
    mutationFn: async (data: GenerateScriptInput) => {
      // Filter tweaks to only include hardware-relevant ones
      const filteredTweaks = { ...data.tweaks };
      for (const [tweakId, enabled] of Object.entries(filteredTweaks)) {
        if (enabled && !hw.loading) {
          const relevance = getTweakRelevance(tweakId, hw);
          if (!relevance.applies) {
            filteredTweaks[tweakId] = false; // Disable incompatible tweaks
          }
        }
      }

      const sessionToken = getStoredToken() ?? undefined;
      const validated = api.script.generate.input.parse({ ...data, tweaks: filteredTweaks, sessionToken });
      const res = await fetch(apiUrl(api.script.generate.path), {
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
