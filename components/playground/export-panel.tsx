"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { playgroundSchema } from "@/lib/playground/schema";
import { schemaToSql, schemaToTypes } from "@/lib/playground/export";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/site/code-block";
import { Button } from "@/components/ui/button";

/**
 * Export panel — turns the live schema IR into the two artifacts you'd ship when
 * graduating to real Supabase: the migration SQL and `database.types.ts`. Both
 * are generated from `playgroundSchema` on the client (pure, no kernel needed).
 */
export function ExportPanel() {
  const sql = React.useMemo(() => schemaToSql(playgroundSchema), []);
  const types = React.useMemo(() => schemaToTypes(playgroundSchema), []);
  const [copied, setCopied] = React.useState<string | null>(null);

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`${label} copied to clipboard`);
      window.setTimeout(() => setCopied((c) => (c === label ? null : c)), 1600);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  return (
    <Tabs defaultValue="sql" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="sql">migration.sql</TabsTrigger>
          <TabsTrigger value="types">database.types.ts</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="sql" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Supabase-compatible DDL —{" "}
            <code className="font-mono text-foreground">fakebase migrate export --supabase</code>
          </p>
          <CopyButton label="SQL" text={sql} copied={copied === "SQL"} onCopy={copy} />
        </div>
        <CodeBlock filename="supabase/migrations/0001_init.sql" code={sql} />
      </TabsContent>

      <TabsContent value="types" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Generated types —{" "}
            <code className="font-mono text-foreground">fakebase types gen</code>
          </p>
          <CopyButton label="Types" text={types} copied={copied === "Types"} onCopy={copy} />
        </div>
        <CodeBlock filename="lib/database.types.ts" code={types} />
      </TabsContent>
    </Tabs>
  );
}

function CopyButton({
  label,
  text,
  copied,
  onCopy,
}: {
  label: string;
  text: string;
  copied: boolean;
  onCopy: (label: string, text: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => onCopy(label, text)}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
