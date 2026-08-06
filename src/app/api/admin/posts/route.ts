import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAdapter } from "@/lib/content";
import {
  assertPublishable,
  assertSlugFree,
  deriveSlug,
  parseSavePayload,
  PayloadError,
} from "@/lib/content/validate";

export async function POST(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { meta, body } = parseSavePayload(await request.json());
    assertPublishable(meta);
    const slug = deriveSlug(meta);
    await assertSlugFree(slug);

    // New posts don't get an `updated` stamp — that's for edits.
    await getAdapter().savePost(slug, body, { ...meta, slug });
    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    if (err instanceof PayloadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Create post failed:", err);
    return NextResponse.json(
      { error: "Could not save the post. See server logs." },
      { status: 500 }
    );
  }
}
