"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createPostAction, type ActionResult } from "@/app/playground/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CallResult } from "@/components/playground/call-result";

export function CreatePostForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createPostAction,
    null,
  );

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <Input name="title" placeholder="Post title" required />
        <Textarea name="body" placeholder="Write something…" rows={3} />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="published"
              className="size-4 accent-[var(--brand)]"
            />
            Publish immediately
          </label>
          <Button type="submit" disabled={pending} className="gap-1.5">
            <Plus className="size-4" />
            {pending ? "Inserting…" : "Insert post"}
          </Button>
        </div>
      </form>
      {state && <CallResult code={state.code} result={state.result} ok={state.ok} />}
    </div>
  );
}
