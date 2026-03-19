import { NextRequest, NextResponse } from "next/server";
import { listSavedSearches, loadSearchFromXls } from "@/lib/xls";

export async function GET(req: NextRequest) {
  try {
    const filename = req.nextUrl.searchParams.get("file");

    if (filename) {
      const rows = loadSearchFromXls(filename);
      return NextResponse.json({ rows });
    }

    const searches = listSavedSearches();
    return NextResponse.json({ searches });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
