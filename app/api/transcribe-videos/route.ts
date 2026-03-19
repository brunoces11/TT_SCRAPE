import { NextRequest, NextResponse } from "next/server";
import { runActorAndGetResults } from "@/lib/apify";
import path from "path";
import fs from "fs";

export const maxDuration = 300;

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

function cleanWebVtt(raw: string): string {
  return raw
    .replace(/^WEBVTT\s*/i, "")
    .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrls, language = "pt", titles = [] } = body;
    const debugLogs: string[] = [];

    debugLogs.push(`[INPUT] videoUrls count: ${videoUrls?.length}, titles count: ${titles?.length}`);

    // Log each sent URL and title
    for (let i = 0; i < videoUrls.length; i++) {
      debugLogs.push(`[SENT ${i}] url=${videoUrls[i]} | title=${titles[i] || "(empty)"}`);
    }

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json(
        { error: "Selecione pelo menos um vídeo." },
        { status: 400 }
      );
    }

    const actorId = process.env.APIFY_TRANSCRIPT_ACTOR_ID || "sociavault/tiktok-transcript-scraper";
    const input = { videoUrls, language: language || "pt" };
    debugLogs.push(`[APIFY] actor=${actorId}, input=${JSON.stringify(input).substring(0, 200)}`);

    const rawItems = await runActorAndGetResults(actorId, input);
    debugLogs.push(`[APIFY] rawItems count: ${rawItems.length}`);

    // Log ALL keys from first rawItem to understand the data structure
    if (rawItems.length > 0) {
      const firstItem = rawItems[0] as Record<string, unknown>;
      debugLogs.push(`[APIFY] first item keys: ${Object.keys(firstItem).join(", ")}`);
      debugLogs.push(`[APIFY] first item videoUrl: ${firstItem.videoUrl || "(undefined)"}`);
      debugLogs.push(`[APIFY] first item url: ${firstItem.url || "(undefined)"}`);
      debugLogs.push(`[APIFY] first item hasTranscript: ${firstItem.hasTranscript}`);
      debugLogs.push(`[APIFY] first item success: ${firstItem.success}`);
      debugLogs.push(`[APIFY] first item message: ${firstItem.message || "(none)"}`);
      debugLogs.push(`[APIFY] first item transcript length: ${String(firstItem.transcript || "").length}`);
      debugLogs.push(`[APIFY] first item transcription length: ${String(firstItem.transcription || "").length}`);
      debugLogs.push(`[APIFY] first item text length: ${String(firstItem.text || "").length}`);
    }

    // Build a map of videoId -> index from the sent URLs
    const idToIndex = new Map<string, number>();
    for (let i = 0; i < videoUrls.length; i++) {
      const match = (videoUrls[i] as string).match(/\/video\/(\d+)/);
      if (match) {
        idToIndex.set(match[1], i);
        debugLogs.push(`[MAP] videoId=${match[1]} -> index=${i}, title=${titles[i] || "(empty)"}`);
      } else {
        debugLogs.push(`[MAP] WARN: no videoId found in url=${videoUrls[i]}`);
      }
    }

    // Save transcripts as .txt files in downloads folder
    debugLogs.push(`[DIR] DOWNLOAD_DIR=${DOWNLOAD_DIR}`);
    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
      debugLogs.push(`[DIR] Created downloads folder`);
    }

    const savedFiles: string[] = [];
    const errors: string[] = [];

    for (let ri = 0; ri < rawItems.length; ri++) {
      const item = rawItems[ri] as Record<string, string>;
      try {
        const itemUrl = item.videoUrl || item.url || "";
        const transcript = item.transcript || item.transcription || item.text || "";

        debugLogs.push(`[ITEM ${ri}] url=${itemUrl.substring(0, 80)}, transcript_len=${transcript.length}, hasTranscript=${item.hasTranscript}, success=${item.success}`);

        if (!transcript) {
          debugLogs.push(`[ITEM ${ri}] SKIP: no transcript available (hasTranscript=${item.hasTranscript}, message=${item.message || "none"})`);
          continue;
        }

        // Extract video ID from returned URL
        const idMatch = itemUrl.match(/\/video\/(\d+)/);
        const videoId = idMatch ? idMatch[1] : "";
        debugLogs.push(`[ITEM ${ri}] extracted videoId=${videoId || "(none)"}`);

        // Find matching title
        let rawTitle = "";
        if (videoId && idToIndex.has(videoId)) {
          const idx = idToIndex.get(videoId)!;
          rawTitle = titles[idx] || "";
          debugLogs.push(`[ITEM ${ri}] MATCHED by videoId, index=${idx}, title=${rawTitle.substring(0, 50)}`);
        } else {
          // Fallback: use index if same count
          if (ri < titles.length && titles[ri]) {
            rawTitle = titles[ri];
            debugLogs.push(`[ITEM ${ri}] FALLBACK by index, title=${rawTitle.substring(0, 50)}`);
          } else {
            debugLogs.push(`[ITEM ${ri}] NO MATCH: videoId=${videoId}, idToIndex has=${[...idToIndex.keys()].join(",")}`);
          }
        }

        if (!rawTitle) {
          debugLogs.push(`[ITEM ${ri}] SKIP: no title matched`);
          continue;
        }

        const cleaned = cleanWebVtt(transcript);
        if (!cleaned.trim()) {
          debugLogs.push(`[ITEM ${ri}] SKIP: cleaned transcript is empty`);
          continue;
        }

        const safeName = sanitizeFilename(rawTitle);
        if (!safeName) {
          debugLogs.push(`[ITEM ${ri}] SKIP: sanitized name is empty`);
          continue;
        }

        const txtPath = path.join(DOWNLOAD_DIR, `${safeName}.txt`);
        debugLogs.push(`[ITEM ${ri}] SAVING: ${txtPath} (${cleaned.length} chars)`);
        fs.writeFileSync(txtPath, cleaned, "utf-8");
        savedFiles.push(`${safeName}.txt`);
        debugLogs.push(`[ITEM ${ri}] SAVED OK`);
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : "unknown error";
        debugLogs.push(`[ITEM ${ri}] ERROR: ${errMsg}`);
        errors.push(errMsg);
      }
    }

    debugLogs.push(`[RESULT] savedFiles=${savedFiles.length}, errors=${errors.length}`);

    return NextResponse.json({ rawItems, savedFiles, errors, debugLogs, downloadDir: DOWNLOAD_DIR });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg, stack: err instanceof Error ? err.stack : "" }, { status: 500 });
  }
}
