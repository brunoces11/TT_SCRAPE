import { NextResponse } from "next/server";
import { getApifyAccounts } from "@/lib/apify-accounts";

export async function GET() {
  const accounts = getApifyAccounts();
  // Return only id, label, default — never expose tokens to frontend
  const safe = accounts.map((a) => ({ id: a.id, label: a.label, default: a.default }));
  return NextResponse.json({ accounts: safe });
}
