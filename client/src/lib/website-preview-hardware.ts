/** Browser-only evidence. Never call this a validated Windows hardware scan. */
export type BrowserHardware = {
  cpu: string;
  gpu: string;
  memory: string;
  os: string;
};

export function describeBrowserHardware(input: {
  threads?: number; memory?: number; renderer?: string; platform?: string;
}): BrowserHardware {
  const renderer = input.renderer?.trim();
  return {
    cpu: input.threads && input.threads > 0
      ? `${input.threads} browser-reported logical processors · CPU model unavailable`
      : "CPU model and processor count unavailable",
    gpu: renderer && !/swiftshader|llvmpipe|software|microsoft basic/i.test(renderer)
      ? `${renderer} · browser-reported renderer, not a full GPU scan`
      : "Physical GPU model unavailable from this browser",
    memory: input.memory && input.memory > 0
      ? `${input.memory} GB browser memory estimate · rounded/capped, not installed RAM`
      : "Installed RAM unavailable from this browser",
    os: /win/i.test(input.platform ?? "") ? "Windows · exact version/build requires the app"
      : input.platform ? `${input.platform} · browser-reported platform`
      : "Operating system unavailable",
  };
}

export function readBrowserHardware(): BrowserHardware {
  const browser = navigator as Navigator & {
    deviceMemory?: number; userAgentData?: { platform?: string };
  };
  let renderer: string | undefined;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    const extension = gl?.getExtension("WEBGL_debug_renderer_info");
    if (gl && extension) renderer = String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL));
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch { /* Browsers may intentionally block GPU identification. */ }
  return describeBrowserHardware({
    threads: browser.hardwareConcurrency, memory: browser.deviceMemory,
    renderer, platform: browser.userAgentData?.platform ?? browser.platform,
  });
}
