import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertPreset } from "@shared/routes";

export function usePresets() {
  return useQuery({
    queryKey: [api.presets.list.path],
    queryFn: async () => {
      const res = await fetch(api.presets.list.path);
      if (!res.ok) throw new Error("Failed to fetch presets");
      return api.presets.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreatePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertPreset) => {
      const validated = api.presets.create.input.parse(data);
      const res = await fetch(api.presets.create.path, {
        method: api.presets.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      
      if (!res.ok) throw new Error("Failed to create preset");
      return api.presets.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.presets.list.path] });
    },
  });
}
