import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

/**
 * WinUI 3 style toggle — strict gray (off) / red (on).
 *
 * - OFF: neutral gray track (zinc-700), darker thumb (zinc-300), no glow.
 * - ON : solid red track (red-500), white thumb, soft outer red glow.
 * - Focus-visible: red focus ring offset against the page background.
 * - 140ms ease transition on color + thumb position.
 * - Larger hit target than the default shadcn switch (h-7 w-12).
 */
const CustomSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
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
        "pointer-events-none block h-6 w-6 rounded-full shadow-lg ring-0",
        "transition-transform duration-[120ms] ease-out",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        // Slightly dimmer thumb when off, pure white when on
        "data-[state=unchecked]:bg-zinc-200 data-[state=checked]:bg-white"
      )}
    />
  </SwitchPrimitives.Root>
))
CustomSwitch.displayName = SwitchPrimitives.Root.displayName

export { CustomSwitch }
