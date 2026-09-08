"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { presentationCookie, validatePresentation } from "@/lib/presentation";
import { createClient } from "@/lib/supabase/server";

export async function setPresentation(enabled: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  try {
    if (enabled) await validatePresentation();
    const store = await cookies();
    if (enabled) store.set(presentationCookie, "1", {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/"
    });
    else store.delete(presentationCookie);
    revalidatePath("/", "layout");
    return { error: null };
  } catch {
    return { error: "Cannot enable presentation mode. Complete EUR history and positive current deployed capital are required." };
  }
}
