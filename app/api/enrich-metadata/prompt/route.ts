import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const PROMPT_FILE = path.join(process.cwd(), "ai-prompt.txt");

const DEFAULT_PROMPT = `You are a social media content specialist. You receive video metadata (title, description, hashtags, transcription) and must return enriched versions that are unique, engaging, and optimized for reach on TikTok/Reels.

Rules:
- Rewrite the title to be more engaging and click-worthy while preserving the core topic
- Rewrite the description to be more compelling, adding relevant context
- Keep existing relevant hashtags and add 3-5 new trending/niche hashtags to increase discoverability
- Rewrite the transcription slightly to make it feel fresh while preserving the original meaning
- If transcription starts with "ERRO:", return it unchanged
- Return ONLY valid JSON in the exact format specified
- Process ALL items in the array and return ALL of them with the same videoId`;

export async function GET() {
  try {
    if (fs.existsSync(PROMPT_FILE)) {
      const prompt = fs.readFileSync(PROMPT_FILE, "utf-8");
      return NextResponse.json({ prompt });
    }
    return NextResponse.json({ prompt: DEFAULT_PROMPT });
  } catch {
    return NextResponse.json({ prompt: DEFAULT_PROMPT });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    fs.writeFileSync(PROMPT_FILE, prompt, "utf-8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
