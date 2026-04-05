import { NextRequest, NextResponse } from "next/server";
import { runActorAndGetResults } from "@/lib/apify";
import path from "path";
import fs from "fs";

export const maxDuration = 300;

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");

interface ActorConfig {
  id: string;
  name: string;
  default: boolean;
  inputUrlField: string;
  inputUrlMode: "array" | "single";
  outputTranscriptField: string;
  outputUrlField: string;
  isWebVtt: boolean;
}

function loadActorConfig(actorId?: string): ActorConfig {
  const configPath = path.join(process.cwd(), "apify-actors.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(raw);
  const actors: ActorConfig[] = config.transcriptActors || [];
  if (actorId) {
    const found = actors.find((a) => a.id === actorId);
    if (found) return found;
  }
  const defaultActor = actors.find((a) => a.default);
  if (defaultActor) return defaultActor;
  if (actors.length > 0) return actors[0];
  throw new Error("No transcript actors configured in apify-actors.json");
}

function getNestedField(obj: Record<string, unknown>, fieldPath: string): string {
  const val = fieldPath.split(".").reduce<unknown>((o, k) => {
    if (o && typeof o === "object" && k in (o as Record<string, unknown>)) {
      return (o as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
  return typeof val === "string" ? val : "";
}

function cleanTikTokUrl(url: string): string {
  // Remove query parameters and fragments, keep only the clean path
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.trim();
  }
}

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

function getErrorSuffix(errorMsg: string): string {
  // Try to extract numeric exit code from Apify actor errors
  const exitCodeMatch = errorMsg.match(/exit code:\s*(\d+)/i);
  if (exitCodeMatch) return `_erro_${exitCodeMatch[1]}`;

  // Try to extract HTTP status code
  const httpMatch = errorMsg.match(/\((\d{3})\)/);
  if (httpMatch) return `_erro_${httpMatch[1]}`;

  // Map known error messages to short abbreviations
  const msg = errorMsg.toLowerCase();
  if (msg.includes("not found") || msg.includes("private")) return "_erro_not_found";
  if (msg.includes("caption") || msg.includes("does not have")) return "_erro_no_caption";
  if (msg.includes("empty")) return "_erro_empty";
  if (msg.includes("timeout") || msg.includes("timed out")) return "_erro_timeout";
  if (msg.includes("actor") && msg.includes("failed")) return "_erro_actor_fail";

  return "_erro_unknown";
}

function buildTxtContent(meta: VideoMeta, transcript: string): string {
  return `Title: ${meta.title}

Description: ${meta.description}

Hashtags: ${meta.hashtags}

Transcription: ${transcript}

Views: ${meta.views.toLocaleString("en-US")}

Likes: ${meta.likes.toLocaleString("en-US")}

Link: ${meta.videoUrl}

Date: ${meta.publishDate}`;
}

export async function POST(request: NextRequest) {
  // Parse body outside try so it's accessible in catch for fallback file generation
  const body = await request.json();
  const { videoUrls, videosMeta = [], actorId: requestedActorId, accountId } = body;
  const debugLogs: string[] = [];

  try {
    const actorConfig = loadActorConfig(requestedActorId);

    debugLogs.push(`[INPUT] videoUrls count: ${videoUrls?.length}, videosMeta count: ${videosMeta?.length}`);

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "Select at least one video." }, { status: 400 });
    }

    debugLogs.push(`[APIFY] actor=${actorConfig.id} (${actorConfig.name})`);

    // Clean URLs before sending to actor (remove query params, fragments)
    const cleanedUrls = videoUrls.map((u: string) => cleanTikTokUrl(u));
    debugLogs.push(`[APIFY] URLs to send: ${JSON.stringify(cleanedUrls).substring(0, 500)}`);

    // Call actor based on inputUrlMode
    let rawItems: unknown[];
    if (actorConfig.inputUrlMode === "single") {
      // Single mode: 1 run per video, collect results
      rawItems = [];
      for (const url of cleanedUrls) {
        try {
          const input = { [actorConfig.inputUrlField]: url };
          const items = await runActorAndGetResults(actorConfig.id, input, accountId);
          rawItems.push(...items);
        } catch (singleErr) {
          const singleMsg = singleErr instanceof Error ? singleErr.message : "Unknown error";
          debugLogs.push(`[APIFY] Single run failed for ${url.substring(0, 60)}: ${singleMsg}`);
        }
      }
    } else {
      // Array mode: 1 run with all URLs
      const input = { [actorConfig.inputUrlField]: cleanedUrls };
      rawItems = await runActorAndGetResults(actorConfig.id, input, accountId);
    }

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
        const itemUrl = getNestedField(item, actorConfig.outputUrlField) || (item as Record<string, string>).url || "";
        const rawTranscript = getNestedField(item, actorConfig.outputTranscriptField) || "";

        debugLogs.push(`[ITEM ${ri}] url=${itemUrl.substring(0, 80)}, transcript_len=${rawTranscript.length}, hasTranscript=${item.hasTranscript}`);

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
          debugLogs.push(`[ITEM ${ri}] SKIP: no meta/title found (cannot generate filename)`);
          noTranscript.push(itemUrl || videoUrls[ri] || `video ${ri}`);
          continue;
        }

        const safeName = sanitizeFilename(meta.title);
        if (!safeName) {
          debugLogs.push(`[ITEM ${ri}] SKIP: sanitized name empty`);
          noTranscript.push(itemUrl || videoUrls[ri] || `video ${ri}`);
          continue;
        }

        const prefix = buildFilePrefix(meta.views, meta.publishDate);

        // Determine transcript content or error message
        let transcriptField: string;
        let errorSuffix = "";
        if (!rawTranscript) {
          const errorDetail = item.message || item.error || "Transcript unavailable — no transcript returned by API";
          transcriptField = `ERRO: ${errorDetail}`;
          errorSuffix = getErrorSuffix(errorDetail);
          noTranscript.push(itemUrl || videoUrls[ri] || `video ${ri}`);
          debugLogs.push(`[ITEM ${ri}] NO TRANSCRIPT: ${errorDetail}`);
        } else {
          const cleaned = actorConfig.isWebVtt ? cleanWebVtt(rawTranscript) : rawTranscript.trim();
          if (!cleaned.trim()) {
            transcriptField = "ERRO: Transcript returned empty after cleaning (WebVTT contained no text content)";
            errorSuffix = "_erro_empty";
            noTranscript.push(itemUrl || videoUrls[ri] || `video ${ri}`);
            debugLogs.push(`[ITEM ${ri}] EMPTY AFTER CLEAN`);
          } else {
            transcriptField = cleaned;
          }
        }

        const txtContent = buildTxtContent(meta, transcriptField);
        const fileName = `${prefix}${safeName}${errorSuffix}.txt`;
        const txtPath = path.join(DOWNLOAD_DIR, fileName);
        fs.writeFileSync(txtPath, txtContent, "utf-8");
        savedFiles.push(fileName);
        debugLogs.push(`[ITEM ${ri}] SAVED: ${fileName} (${txtContent.length} chars)`);
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : "unknown error";
        debugLogs.push(`[ITEM ${ri}] ERROR: ${errMsg}`);
        errors.push(errMsg);
      }
    }

    debugLogs.push(`[RESULT] savedFiles=${savedFiles.length}, noTranscript=${noTranscript.length}, errors=${errors.length}`);
    return NextResponse.json({ rawItems, savedFiles, errors, noTranscript, debugLogs, downloadDir: DOWNLOAD_DIR });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // On any error, save .txt files with metadata + error in transcription field
    const fallbackSaved: string[] = [];
    const fallbackLogs: string[] = [...debugLogs, `❌ [TRANSCRIPT] Apify service failed: ${msg}`];

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    for (let i = 0; i < videosMeta.length; i++) {
      const meta = videosMeta[i] as VideoMeta | undefined;
      if (!meta || !meta.title) continue;
      const safeName = sanitizeFilename(meta.title);
      if (!safeName) continue;
      const prefix = buildFilePrefix(meta.views, meta.publishDate);
      const errorSuffix = getErrorSuffix(msg);
      const txtContent = buildTxtContent(meta, `ERRO: Apify actor failed — ${msg}`);
      const fileName = `${prefix}${safeName}${errorSuffix}.txt`;
      const txtPath = path.join(DOWNLOAD_DIR, fileName);
      fs.writeFileSync(txtPath, txtContent, "utf-8");
      fallbackSaved.push(fileName);
      fallbackLogs.push(`[FALLBACK] SAVED: ${fileName} (metadata only, transcript error)`);
    }

    return NextResponse.json({
      error: null,
      actorFailed: true,
      actorError: msg,
      rawItems: [],
      savedFiles: fallbackSaved,
      errors: [msg],
      noTranscript: videoUrls,
      debugLogs: fallbackLogs,
      downloadDir: DOWNLOAD_DIR,
    });
  }
}
