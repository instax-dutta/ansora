import { NextRequest, NextResponse } from "next/server";
import { getSession, isCrossOrigin } from "@/lib/auth/session";
import { renderMarkdown } from "@/lib/markdown/render";

/**
 * Live-preview endpoint for the admin editor.
 *
 * The editor preview MUST render through the exact same server pipeline as
 * the public site (render.ts). It cannot use react-markdown client-side:
 * react-markdown executes its unified pipeline synchronously (runSync), which
 * is incompatible with async plugins like rehype-pretty-code/Shiki — that
 * combination 500s the edit page during SSR and in the browser alike.
 */
export async function POST(request: NextRequest) {
  if (isCrossOrigin(request)) {
    return NextResponse.json(
      { error: "Cross-origin request blocked." },
      { status: 403 }
    );
  }
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const markdown =
    typeof body === "object" && body !== null && "markdown" in body
      ? (body as { markdown: unknown }).markdown
      : undefined;
  // Hard cap: previews are interactive; anything beyond a long post is abuse
  // of the endpoint rather than a real editing session.
  if (typeof markdown !== "string" || markdown.length > 200_000) {
    return NextResponse.json(
      { error: "`markdown` must be a string of at most 200,000 characters." },
      { status: 400 }
    );
  }

  try {
    const html = await renderMarkdown(markdown);
    return NextResponse.json({ html });
  } catch (err) {
    console.error("Preview render failed:", err);
    return NextResponse.json(
      { error: "Could not render the preview." },
      { status: 500 }
    );
  }
}
