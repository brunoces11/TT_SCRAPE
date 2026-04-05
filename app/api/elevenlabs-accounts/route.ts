import { NextResponse } from "next/server";
import { getElevenLabsAccounts } from "@/lib/elevenlabs-accounts";

export async function GET() {
  const accounts = getElevenLabsAccounts();
  // Return only id, label, default — never expose tokens to frontend
  const safe = accounts.map((a) => ({ id: a.id, label: a.label, default: a.default }));
  return NextResponse.json({ accounts: safe });
}
