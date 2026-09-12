import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Definition, wordForms } from "@/lib/dictionary";
const cache = new Map<string, Record<string, Definition>>();
export async function GET(request: NextRequest) {
  const term =
    request.nextUrl.searchParams.get("term")?.trim().toLowerCase() || "";
  if (!/^[a-z][a-z '\-]{0,79}$/.test(term))
    return NextResponse.json({ entry: null });
  try {
    for (const form of wordForms(term)) {
      const key = form
        .replace(/[^a-z]/g, "")
        .slice(0, 2)
        .padEnd(2, "_");
      let entries = cache.get(key);
      if (!entries) {
        try {
          entries = JSON.parse(
            await readFile(
              path.join(process.cwd(), "data/ecdict/shards", `${key}.json`),
              "utf8",
            ),
          );
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
          throw e;
        }
        if (cache.size > 60) cache.clear();
        cache.set(key, entries!);
      }
      if (entries && Object.hasOwn(entries, form))
        return NextResponse.json(
          { entry: entries[form] },
          { headers: { "Cache-Control": "public, max-age=86400" } },
        );
    }
    return NextResponse.json({ entry: null });
  } catch {
    return NextResponse.json({ message: "词库读取失败" }, { status: 503 });
  }
}
