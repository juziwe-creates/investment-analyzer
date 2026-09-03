import { cn } from "@/lib/utils";

type AlphaLogoProps = {
  collapsed?: boolean;
  className?: string;
};

export function AlphaLogo({ collapsed = false, className }: AlphaLogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="font-semibold leading-none text-[hsl(var(--accent-brand))] text-[1.7rem]">
        α
      </span>
      {!collapsed ? (
        <span className="text-[1.05rem] font-medium tracking-[-0.01em] text-foreground">
          Alpha
        </span>
      ) : null}
    </div>
  );
}
