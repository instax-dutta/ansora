import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAdapter } from "@/lib/content";
import { siteConfigSchema } from "@/lib/content/types";

export async function PUT(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = siteConfigSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid settings: check the fields." },
        { status: 400 }
      );
    }
    await getAdapter().saveSiteConfig(parsed.data);
    return NextResponse.json({ ok: true, config: parsed.data });
  } catch (err) {
    console.error("Save settings failed:", err);
    return NextResponse.json(
      { error: "Could not save settings. See server logs." },
      { status: 500 }
    );
  }
}
