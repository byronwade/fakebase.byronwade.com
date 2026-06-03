import { cn } from "@/lib/utils";

/** A window-chromed code surface for marketing snippets (display only). */
export function CodeBlock({
  code,
  filename,
  className,
}: {
  code: string;
  filename?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-float",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive/40" />
          <span className="size-2.5 rounded-full bg-warning/50" />
          <span className="size-2.5 rounded-full bg-success/50" />
        </span>
        {filename && (
          <span className="ml-1 font-mono text-xs text-muted-foreground">
            {filename}
          </span>
        )}
      </div>
      <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed">
        <code className="font-mono text-card-foreground">{code}</code>
      </pre>
    </div>
  );
}
