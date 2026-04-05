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

export async function POST(request: NextRequest) {
  try {
    const { text, title, accountId, voiceId } = (await request.json()) as {
      text: string;
      title: string;
      accountId?: string;
      voiceId: string;
    };

    const token = getTokenForElevenLabsAccount(accountId);

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ElevenLabs API error (${res.status}): ${errText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    const filename = `${sanitizeFilename(title)}.mp3`;
    fs.writeFileSync(path.join(DOWNLOAD_DIR, filename), buffer);

    return NextResponse.json({ status: "ok", filename });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
