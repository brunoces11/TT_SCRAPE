import { NextRequest, NextResponse } from "next/server";
import { getTokenForElevenLabsAccount } from "@/lib/elevenlabs-accounts";
import path from "path";
import fs from "fs";

export const maxDuration = 120;

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");

function sanitizeFilename(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 100);
}

const MONTH_ABBR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

function buildFilePrefix(views: number, publishDate: string): string {
  let datePart = "";
  if (publishDate) {
    const d = new Date(publishDate);
    if (!isNaN(d.getTime())) {
      const mmm = MONTH_ABBR[d.getMonth()];
      const aa = String(d.getFullYear()).slice(-2);
      datePart = `${mmm}${aa}`;
    }
  }
  const v = views || 0;
  const tier = v >= 10_000_000 ? "1A" : v >= 1_000_000 ? "2A" : "3A";
  const viewsPart = String(v);
  return datePart ? `${tier}_${viewsPart}-${datePart}-` : `${tier}_${viewsPart}-`;
}

export async function POST(request: NextRequest) {
  try {
    const { text, title, accountId, voiceId, views, publishDate } = (await request.json()) as {
      text: string;
      title: string;
      accountId?: string;
      voiceId: string;
      views?: number;
      publishDate?: string;
    };

    const apiKey = getTokenForElevenLabsAccount(accountId);

    // Mistral Voxtral TTS API with retry (3 attempts, 10s wait between)
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 10_000;
    let lastError = "";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch("https://api.mistral.ai/v1/audio/speech", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "voxtral-mini-tts-latest",
            input: text,
            voice: voiceId || "jessica",
            response_format: "mp3",
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          lastError = `Mistral TTS API error (${res.status}): ${errText}`;
          // Only retry on 5xx server errors
          if (res.status >= 500 && attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          throw new Error(lastError);
        }

        const data = await res.json();
        const audioData = data.audio_data;
        if (!audioData) {
          throw new Error("Mistral TTS returned empty audio_data");
        }

        const buffer = Buffer.from(audioData, "base64");

        if (!fs.existsSync(DOWNLOAD_DIR)) {
          fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
        }

        const prefix = buildFilePrefix(views || 0, publishDate || "");
        const filename = `${prefix}${sanitizeFilename(title)}.mp3`;
        fs.writeFileSync(path.join(DOWNLOAD_DIR, filename), buffer);

        return NextResponse.json({ status: "ok", filename });
      } catch (attemptErr) {
        lastError = attemptErr instanceof Error ? attemptErr.message : "Unknown error";
        if (attempt < MAX_RETRIES && lastError.includes("500")) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        throw attemptErr;
      }
    }

    throw new Error(`Mistral TTS failed after ${MAX_RETRIES} attempts: ${lastError}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
