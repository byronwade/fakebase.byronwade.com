"use server";

import { revalidatePath } from "next/cache";
import { getPlaygroundClient, resetPlayground } from "@/lib/playground/client";
import { DEMO_USER_ID, playgroundSchema } from "@/lib/playground/schema";
import { buildQueryCode, sanitizeSpec, type QuerySpec } from "@/lib/playground/query";

/** Result envelope surfaced next to the code that produced it. */
export type ActionResult = {
  ok: boolean;
  code: string;
  result: unknown;
};

function envelope(
  code: string,
  result: { data: unknown; error: unknown },
): ActionResult {
  return { ok: !result.error, code, result };
}

export async function createPostAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const published = formData.get("published") === "on";

  const code = `await supabase.from("posts").insert({
  title: ${JSON.stringify(title)},
  body: ${JSON.stringify(body)},
  user_id, published: ${published},
}).select()`;

  if (!title) {
    return {
      ok: false,
      code,
      result: { data: null, error: { message: "title is required" } },
    };
  }

  const supabase = await getPlaygroundClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      title,
      body,
      user_id: DEMO_USER_ID,
      published,
      view_count: 0,
      created_at: now,
      updated_at: now,
    })
    .select();

  revalidatePath("/playground");
  return envelope(code, { data, error });
}

export async function togglePostAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const next = formData.get("published") === "true";
  const supabase = await getPlaygroundClient();
  await supabase
    .from("posts")
    .update({ published: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/playground");
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const supabase = await getPlaygroundClient();
  await supabase.from("posts").delete().eq("id", id);
  revalidatePath("/playground");
}

export async function resetAction(): Promise<void> {
  await resetPlayground();
  revalidatePath("/playground");
}

export async function signUpAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const code = `await supabase.auth.signUp({ email: ${JSON.stringify(email)}, password })`;
  const supabase = await getPlaygroundClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  revalidatePath("/playground");
  return envelope(code, { data, error });
}

export async function signInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const code = `await supabase.auth.signInWithPassword({ email: ${JSON.stringify(email)}, password })`;
  const supabase = await getPlaygroundClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  revalidatePath("/playground");
  return envelope(code, { data, error });
}

export async function signOutAction(): Promise<void> {
  const supabase = await getPlaygroundClient();
  await supabase.auth.signOut();
  revalidatePath("/playground");
}

/**
 * Run a constrained query spec (assembled in the query console) against the
 * visitor's kernel and return the real `{ data, error }`. The spec is sanitized
 * against `playgroundSchema` first, so only whitelisted tables/columns reach the
 * client — no arbitrary code is evaluated.
 */
export async function runQueryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw: QuerySpec = {
    table: String(formData.get("table") ?? "posts"),
    columns: String(formData.get("columns") ?? "*"),
    filterColumn: String(formData.get("filterColumn") ?? "") || undefined,
    filterValue: String(formData.get("filterValue") ?? "") || undefined,
    orderColumn: String(formData.get("orderColumn") ?? "") || undefined,
    ascending: formData.get("ascending") === "true",
    limit: Number(formData.get("limit") ?? 20) || undefined,
  };

  const spec = sanitizeSpec(playgroundSchema, raw);
  if (!spec) {
    return {
      ok: false,
      code: buildQueryCode(raw),
      result: { data: null, error: { message: `unknown table "${raw.table}"` } },
    };
  }

  const code = buildQueryCode(spec);
  const supabase = await getPlaygroundClient();
  // The console table is a runtime string; the typed `.from()` overloads can't
  // narrow it, so cast at this single boundary.
  let query = supabase.from(spec.table as never).select(spec.columns);
  if (spec.filterColumn && spec.filterValue !== undefined) {
    query = query.eq(spec.filterColumn, spec.filterValue);
  }
  if (spec.orderColumn) {
    query = query.order(spec.orderColumn, { ascending: Boolean(spec.ascending) });
  }
  if (spec.limit) {
    query = query.limit(spec.limit);
  }
  const { data, error } = await query;
  return envelope(code, { data, error });
}

/**
 * Insert a throwaway post to demonstrate the realtime stream: the kernel's
 * `postgres_changes` bus fires and the open SSE connection forwards the event to
 * the Realtime panel. Does not revalidate — the live feed is client-driven.
 */
export async function realtimeInsertAction(): Promise<void> {
  const supabase = await getPlaygroundClient();
  const now = new Date().toISOString();
  const n = Math.floor((Date.parse(now) / 1000) % 1000);
  await supabase.from("posts").insert({
    title: `Realtime post #${n}`,
    body: "Inserted from the Realtime panel — watch the stream below.",
    user_id: DEMO_USER_ID,
    published: true,
    view_count: 0,
    created_at: now,
    updated_at: now,
  });
}
