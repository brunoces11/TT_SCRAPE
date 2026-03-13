import { NextRequest, NextResponse } from "next/server";
import { runActorAndGetResults } from "@/lib/apify";
import { normalizeChannelVideos } from "@/lib/normalize";

// Allow up to 5 minutes for channel actor to finish
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelUrl, resultsPerPage = 30 } = body;

    // Validate URL
    if (!channelUrl || typeof channelUrl !== "string") {
      return NextResponse.json(
        { error: "URL do canal é obrigatória." },
        { status: 400 }
      );
    }

    const tiktokUrlPattern = /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?$/;
    if (!tiktokUrlPattern.test(channelUrl.trim())) {
      return NextResponse.json(
        { error: "URL inválida. Use o formato: https://www.tiktok.com/@usuario" },
        { status: 400 }
      );
    }

    const actorId = process.env.APIFY_CHANNEL_ACTOR_ID || "clockworks/tiktok-scraper";

    const input = {
      profiles: [channelUrl.trim()],
      resultsPerPage: Number(resultsPerPage) || 30,
    };

    const rawItems = await runActorAndGetResults(actorId, input);
    const rows = normalizeChannelVideos(rawItems);

    return NextResponse.json({ rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";

    if (message.includes("TIMEOUT")) {
      return NextResponse.json({ error: message }, { status: 504 });
    }

    return NextResponse.json(
      { error: `Erro ao buscar dados do canal: ${message}` },
      { status: 500 }
    );
  }
}
