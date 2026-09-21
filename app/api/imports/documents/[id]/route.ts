import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: document } = await supabase.from("source_documents").select("storage_path").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!document?.storage_path) return NextResponse.json({ error: "Document unavailable" }, { status: 404 });
  const { data, error } = await supabase.storage.from("source-documents").createSignedUrl(document.storage_path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Document unavailable" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
