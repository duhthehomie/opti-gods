import { cn } from "@/lib/utils";

type Variant = "hero" | "inline";

const SIZES: Record<Variant, { wrap: string; main: string; sub: string; pad: string }> = {
  hero: {
    wrap: "gap-3",
    main: "text-5xl md:text-7xl tracking-[0.18em]",
    sub: "text-[10px] md:text-xs tracking-[0.45em]",
    pad: "px-7 py-5 md:px-10 md:py-6",
  },
  inline: {
    wrap: "gap-2",
    main: "text-2xl md:text-3xl tracking-[0.18em]",
    sub: "text-[9px] md:text-[10px] tracking-[0.4em]",
    pad: "px-5 py-3",
  },
};

export function OptiGodsWordmark({
  variant = "hero",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const s = SIZES[variant];
  return (
    <div
      data-testid={`wordmark-${variant}`}
      className={cn(
        "optigods-wordmark inline-flex flex-col items-center justify-center",
        "rounded-2xl border border-red-500/40 bg-black/80 backdrop-blur-sm",
        "relative overflow-hidden",
        s.wrap,
        s.pad,
        className,
      )}
      style={{
        boxShadow:
          "0 0 0 1px rgba(239,68,68,0.15), 0 0 40px -10px rgba(239,68,68,0.55), inset 0 0 30px -10px rgba(239,68,68,0.25)",
      }}
    >
      <span aria-hidden className="optigods-wordmark__ring" />
      <h1
        className={cn(
          "relative z-10 font-display font-black uppercase leading-none",
          "optigods-wordmark__text",
          s.main,
        )}
      >
        opti gods
      </h1>
      <span
        className={cn(
          "relative z-10 font-mono font-bold uppercase text-red-300/80",
          s.sub,
        )}
      >
        by leaq
      </span>
    </div>
  );
}
