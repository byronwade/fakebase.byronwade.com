import { cn } from "@/lib/utils";

/** Shows the exact call that ran beside the real { data, error } it returned —
 *  the core "aha" of the live playground. */
export function CallResult({
  code,
  result,
  ok,
  className,
}: {
  code: string;
  result: unknown;
  ok?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 md:grid-cols-2", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border/60 bg-muted/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          your call
        </div>
        <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed">
          <code className="font-mono text-card-foreground">{code}</code>
        </pre>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-card",
          ok === false ? "border-destructive/40" : "border-success/40",
        )}
      >
        <div
          className={cn(
            "border-b px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide",
            ok === false
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-success/30 bg-success/10 text-success",
          )}
        >
          {`{ data, error } returned`}
        </div>
        <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed">
          <code className="font-mono text-card-foreground">
            {JSON.stringify(result, null, 2)}
          </code>
        </pre>
      </div>
    </div>
  );
}
