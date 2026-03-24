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

interface VideoMeta {
  title: string;
  views: number;
  likes: number;
  comments: number;
  description: string;
  hashtags: string;
  videoUrl: string;
  publishDate: string;
}

function buildTxtContent(meta: VideoMeta, transcript: string): string {
  return `Title: ${meta.title}

Views: ${meta.views.toLocaleString("pt-BR")}

Likes: ${meta.likes.toLocaleString("pt-BR")}

Description: ${meta.description}

Hashtags: ${meta.hashtags}

Link: ${meta.videoUrl}

Date: ${meta.publishDate}

Transcription: ${transcript}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrls, videosMeta = [] } = body;
    const debugLogs: string[] = [];

    debugLogs.push(`[INPUT] videoUrls count: ${videoUrls?.length}, videosMeta count: ${videosMeta?.length}`);

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "Selecione pelo menos um vídeo." }, { status: 400 });
    }

    const actorId = process.env.APIFY_TRANSCRIPT_ACTOR_ID || "sociavault/tiktok-transcript-scraper";
    // No language param — let the actor detect the original language
    const input = { videoUrls };
    debugLogs.push(`[APIFY] actor=${actorId}`);

    const rawItems = await runActorAndGetResults(actorId, input);
    debugLogs.push(`[APIFY] rawItems count: ${rawItems.length}`);

    if (rawItems.length > 0) {
      const first = rawItems[0] as Record<string, unknown>;
      debugLogs.push(`[APIFY] first item keys: ${Object.keys(first).join(", ")}`);
      debugLogs.push(`[APIFY] hasTranscript=${first.hasTranscript}, success=${first.success}, message=${first.message || "(none)"}`);
      debugLogs.push(`[APIFY] transcript len=${String(first.transcript || "").length}`);
    }

    // Build videoId -> meta map from sent data
    const idToMeta = new Map<string, VideoMeta>();
    for (let i = 0; i < videoUrls.length; i++) {
      const match = (videoUrls[i] as string).match(/\/video\/(\d+)/);
      if (match && videosMeta[i]) {
        idToMeta.set(match[1], videosMeta[i]);
      }
    }

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    const savedFiles: string[] = [];
    const errors: string[] = [];
    const noTranscript: string[] = []; // URLs sem transcrição disponível

    for (let ri = 0; ri < rawItems.length; ri++) {
      const item = rawItems[ri] as Record<string, string>;
      try {
        const itemUrl = item.videoUrl || item.url || "";
        const transcript = item.transcript || item.transcription || item.text || "";

        debugLogs.push(`[ITEM ${ri}] url=${itemUrl.substring(0, 80)}, transcript_len=${transcript.length}, hasTranscript=${item.hasTranscript}`);

        if (!transcript) {
          debugLogs.push(`[ITEM ${ri}] SKIP: no transcript (message=${item.message || "none"})`);
          noTranscript.push(itemUrl || videoUrls[ri] || `video ${ri}`);
          continue;
        }

        const idMatch = itemUrl.match(/\/video\/(\d+)/);
        const videoId = idMatch ? idMatch[1] : "";

        // Find matching meta
        let meta: VideoMeta | null = null;
        if (videoId && idToMeta.has(videoId)) {
          meta = idToMeta.get(videoId)!;
        } else if (ri < videosMeta.length && videosMeta[ri]) {
          meta = videosMeta[ri];
          debugLogs.push(`[ITEM ${ri}] FALLBACK meta by index`);
        }

        if (!meta || !meta.title) {
          debugLogs.push(`[ITEM ${ri}] SKIP: no meta/title found`);
          noTranscript.push(itemUrl || videoUrls[ri] || `video ${ri}`);
          continue;
        }

        const cleaned = cleanWebVtt(transcript);
        if (!cleaned.trim()) {
          debugLogs.push(`[ITEM ${ri}] SKIP: cleaned transcript empty`);
          noTranscript.push(itemUrl || videoUrls[ri] || `video ${ri}`);
          continue;
        }

        const safeName = sanitizeFilename(meta.title);
        if (!safeName) {
          debugLogs.push(`[ITEM ${ri}] SKIP: sanitized name empty`);
          noTranscript.push(itemUrl || videoUrls[ri] || `video ${ri}`);
          continue;
        }

        const txtContent = buildTxtContent(meta, cleaned);
        const txtPath = path.join(DOWNLOAD_DIR, `${safeName}.txt`);
        fs.writeFileSync(txtPath, txtContent, "utf-8");
        savedFiles.push(`${safeName}.txt`);
        debugLogs.push(`[ITEM ${ri}] SAVED: ${safeName}.txt (${txtContent.length} chars)`);
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : "unknown error";
        debugLogs.push(`[ITEM ${ri}] ERROR: ${errMsg}`);
        errors.push(errMsg);
      }
    }

    debugLogs.push(`[RESULT] savedFiles=${savedFiles.length}, noTranscript=${noTranscript.length}, errors=${errors.length}`);
    return NextResponse.json({ rawItems, savedFiles, errors, noTranscript, debugLogs, downloadDir: DOWNLOAD_DIR });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    // Distinguish Apify actor failure from other errors
    if (msg.includes("Actor run failed")) {
      return NextResponse.json({
        error: null,
        actorFailed: true,
        actorError: msg,
        rawItems: [],
        savedFiles: [],
        errors: [msg],
        noTranscript: [],
        debugLogs: [`[APIFY] ${msg}`],
        downloadDir: DOWNLOAD_DIR,
      });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
