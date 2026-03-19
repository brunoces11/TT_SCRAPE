import { NextRequest, NextResponse } from "next/server";
import { listSavedSearches, loadSearchFromXls, deleteRowsFromXls, addToBlacklist } from "@/lib/xls";

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

export async function DELETE(req: NextRequest) {
  try {
    const { filename, videoUrls } = await req.json();

    if (!filename || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    const deleted = deleteRowsFromXls(filename, videoUrls);
    addToBlacklist(videoUrls);
    return NextResponse.json({ deleted, message: `${deleted} registro(s) removido(s) do XLSX e adicionado(s) à blacklist.` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
