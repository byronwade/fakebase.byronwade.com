"use server";

import { revalidatePath } from "next/cache";
import { getPlaygroundClient, resetPlayground } from "@/lib/playground/client";
import { DEMO_USER_ID } from "@/lib/playground/schema";

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
