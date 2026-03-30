import { NextRequest, NextResponse } from "next/server";
import { getTokenForAccount } from "@/lib/apify-accounts";

const BASE_URL = "https://api.apify.com/v2";

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get("accountId") || undefined;
    const token = getTokenForAccount(accountId);

    const res = await fetch(`${BASE_URL}/users/me/limits?token=${token}`);
    if (!res.ok) {
      return NextResponse.json({ error: `Apify API error (${res.status})` }, { status: 500 });
    }
    const data = await res.json();
    const current = data.data?.current;
    const limits = data.data?.limits;

    return NextResponse.json({
      usedUsd: current?.monthlyUsageUsd ?? 0,
      limitUsd: limits?.maxMonthlyUsageUsd ?? 0,
      remainingUsd: (limits?.maxMonthlyUsageUsd ?? 0) - (current?.monthlyUsageUsd ?? 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
