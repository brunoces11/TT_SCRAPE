import { NextRequest, NextResponse } from "next/server";
import { runActorAndGetResults } from "@/lib/apify";
import { normalizeChannelVideos } from "@/lib/normalize";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelUrl, keyword, hashtag, maxVideos = 50, countryCode = "BR" } = body;

    if (!channelUrl && !keyword && !hashtag) {
      return NextResponse.json(
        { error: "Preencha pelo menos um campo: URL do canal, palavra-chave ou hashtag." },
        { status: 400 }
      );
    }

    const actorId = process.env.APIFY_CHANNEL_ACTOR_ID || "clockworks/tiktok-scraper";

    // Build input based on which fields are filled
    const input: Record<string, unknown> = {
      resultsPerPage: Number(maxVideos) || 50,
      proxyCountryCode: countryCode || "None",
    };

    if (channelUrl) {
      const tiktokUrlPattern = /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?$/;
      if (!tiktokUrlPattern.test(channelUrl.trim())) {
        return NextResponse.json(
          { error: "URL inválida. Use o formato: https://www.tiktok.com/@usuario" },
          { status: 400 }
        );
      }
      input.profiles = [channelUrl.trim()];
    }

    if (keyword) {
      input.searchQueries = [keyword.trim()];
      input.searchSection = "";
      input.maxProfilesPerQuery = 10;
    }

    if (hashtag) {
      // Split by comma to support multiple hashtags
      const tags = hashtag.split(",").map((t: string) => t.trim().replace(/^#/, "")).filter(Boolean);
      if (tags.length > 0) {
        input.hashtags = tags;
      }
    }

    const rawItems = await runActorAndGetResults(actorId, input);
    const rows = normalizeChannelVideos(rawItems);

    // Sort by views descending
    rows.sort((a, b) => b.views - a.views);

    return NextResponse.json({ rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";

    if (message.includes("TIMEOUT")) {
      return NextResponse.json({ error: message }, { status: 504 });
    }

    return NextResponse.json(
      { error: `Erro ao buscar dados: ${message}` },
      { status: 500 }
    );
  }
}
