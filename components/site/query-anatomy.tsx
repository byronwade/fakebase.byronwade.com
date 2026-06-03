import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = {
  label: string;
  owner: string;
  detail: string;
  code: string;
  tone?: "brand" | "neutral";
};

const STAGES: Stage[] = [
  {
    label: "Your call",
    owner: "your app",
    detail: "The exact @supabase/supabase-js chain — nothing Fakebase-specific.",
    code: `supabase
  .from("posts")
  .select("*")
  .eq("published", true)`,
    tone: "brand",
  },
  {
    label: "Facade",
    owner: "@byronwade/client",
    detail: "The builder records the chain; nothing executes until you await it.",
    code: `DatabaseBuilder {
  table: "posts",
  filters: [{ column: "published", op: "eq", value: true }],
}`,
  },
  {
    label: "Query compiler",
    owner: "@byronwade/core",
    detail: "The chain is compiled into a QueryPlan the adapter can run.",
    code: `QueryPlan {
  schema: "public", table: "posts",
  operation: "select",
  filters: [{ column: "published", op: "eq", value: true }],
  orderBy: [], projection: "*",
}`,
  },
  {
    label: "Policy engine",
    owner: "@byronwade/core",
    detail:
      "USING / WITH CHECK predicates run for the role. (RLS off here → allow; with RLS on, a JS predicate filters rows.)",
    code: `role: "anon"  ·  rlsEnabled: false
→ allow all rows`,
  },
  {
    label: "Adapter",
    owner: "adapter-memory",
    detail:
      "The plan runs against the store; every adapter passes the same contract suite.",
    code: `store.get("public.posts")
  .filter(r => r.published === true)`,
  },
  {
    label: "Result",
    owner: "back to your app",
    detail: "The familiar { data, error } envelope — identical to Supabase.",
    code: `{ data: [{ id, title, published: true, … }],
  error: null }`,
    tone: "brand",
  },
];

/** Annotated trace of one real query through the stack. Shapes are
 *  representative; run the real thing live in /playground. */
export function QueryAnatomy() {
  return (
    <ol className="space-y-1">
      {STAGES.map((stage, i) => (
        <li key={stage.label}>
          <div
            className={cn(
              "grid gap-3 rounded-2xl border p-4 shadow-card sm:grid-cols-[200px_minmax(0,1fr)]",
              stage.tone === "brand"
                ? "border-brand/30 bg-brand/5"
                : "border-border bg-card",
            )}
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full font-mono text-xs font-semibold",
                    stage.tone === "brand"
                      ? "bg-brand/15 text-brand"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="font-medium">{stage.label}</span>
              </div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                {stage.owner}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {stage.detail}
              </p>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-border/60 bg-background/40 p-3 text-[12px] leading-relaxed">
              <code className="font-mono text-card-foreground">{stage.code}</code>
            </pre>
          </div>
          {i < STAGES.length - 1 && (
            <div className="flex justify-center py-0.5 text-muted-foreground">
              <ArrowDown className="size-4" />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
