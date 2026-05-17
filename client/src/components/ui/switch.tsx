import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/**
 * Base shadcn Switch — restyled to match the WinUI 3 gray/red CustomSwitch
 * used by every TweakRow in the optimizer. Keeps the same API/sizing
 * (h-6 w-11, h-5 thumb) so existing layouts (admin panels, settings dialogs)
 * don't shift, but swaps the colour scheme to neutral-gray off / red on
 * with the same red glow + focus ring.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
      "transition-all duration-[120ms] ease-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // OFF — neutral gray, subtle hover lift
      "data-[state=unchecked]:bg-zinc-700 data-[state=unchecked]:hover:bg-zinc-600",
      // ON — solid red + red glow
      "data-[state=checked]:bg-red-500 data-[state=checked]:hover:bg-red-400",
      "data-[state=checked]:shadow-[0_0_0_1px_rgba(239,68,68,0.4),0_0_14px_-2px_rgba(239,68,68,0.7)]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0",
        "transition-transform duration-[120ms] ease-out",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        "data-[state=unchecked]:bg-zinc-200 data-[state=checked]:bg-white"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
