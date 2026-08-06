import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAdapter } from "@/lib/content";
import {
  assertPublishable,
  assertSlugFree,
  deriveSlug,
  isUnchangedPost,
  parseSavePayload,
  PayloadError,
} from "@/lib/content/validate";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug: currentSlug } = await params;
    const { meta, body } = parseSavePayload(await request.json());
    assertPublishable(meta);

    const slug = deriveSlug(meta, currentSlug);
    await assertSlugFree(slug, currentSlug);

    const existing = await getAdapter().getPost(currentSlug);
    const merged = { ...meta, slug };

    // No-op saves (e.g. clicking Save with nothing changed) must not create a
    // commit or re-stamp `updated` — checked before the stamping below.
    if (existing && isUnchangedPost(existing, merged, body)) {
      return NextResponse.json({ ok: true, slug });
    }

    // Stamp `updated` on edits to published posts (drafts keep their history).
    if (merged.published) {
      merged.updated = new Date().toISOString();
    } else if (existing) {
      merged.updated = existing.meta.updated;
    }

    await getAdapter().savePost(slug, body, merged);

    // Renames: remove the old file so the slug change is a true move.
    if (slug !== currentSlug && existing) {
      await getAdapter().deletePost(currentSlug);
    }

    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    if (err instanceof PayloadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Update post failed:", err);
    return NextResponse.json(
      { error: "Could not save the post. See server logs." },
      { status: 500 }
    );
  }
}

/** Quick publish/draft toggle from the posts table. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug } = await params;
    const body = await request.json();
    const published = Boolean(body?.published);

    const post = await getAdapter().getPost(slug);
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const merged = { ...post.meta, published };

    // Toggling to the value it already has is a no-op — skip the save.
    if (isUnchangedPost(post, merged, post.content)) {
      return NextResponse.json({ ok: true, meta: merged });
    }

    if (published) {
      if (!merged.title.trim() || !merged.excerpt.trim()) {
        return NextResponse.json(
          { error: "Add a title and excerpt before publishing." },
          { status: 400 }
        );
      }
      merged.updated = new Date().toISOString();
    }

    await getAdapter().savePost(slug, post.content, merged);
    return NextResponse.json({ ok: true, meta: merged });
  } catch (err) {
    console.error("Toggle publish failed:", err);
    return NextResponse.json(
      { error: "Could not update the post. See server logs." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug } = await params;
    await getAdapter().deletePost(slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete post failed:", err);
    return NextResponse.json(
      { error: "Could not delete the post. See server logs." },
      { status: 500 }
    );
  }
}
