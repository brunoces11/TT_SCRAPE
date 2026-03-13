import { NextRequest, NextResponse } from "next/server";
import { runActorAndGetResults } from "@/lib/apify";

// Allow up to 5 minutes for transcript actor to finish
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrls, language = "pt" } = body;

    // Validate input
    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json(
        { error: "Selecione pelo menos um vídeo." },
        { status: 400 }
      );
    }

    const actorId = process.env.APIFY_TRANSCRIPT_ACTOR_ID || "sociavault/tiktok-transcript-scraper";

    const input = {
      videoUrls,
      language: language || "pt",
    };

    const rawItems = await runActorAndGetResults(actorId, input);

    return NextResponse.json({ rawItems });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";

    if (message.includes("TIMEOUT")) {
      return NextResponse.json({ error: message }, { status: 504 });
    }

    return NextResponse.json(
      { error: `Erro ao buscar transcrições: ${message}` },
      { status: 500 }
    );
  }
}
