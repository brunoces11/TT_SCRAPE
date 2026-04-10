import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const maxDuration = 600;

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

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

interface VideoForLLM {
  videoId: string;
  title: string;
  description: string;
  hashtags: string;
  transcription: string;
}

interface VideoMeta {
  videoId: string;
  title: string;
  views: number;
  likes: number;
  description: string;
  hashtags: string;
  videoUrl: string;
  publishDate: string;
  transcription: string;
}

interface LLMResponse {
  videos: VideoForLLM[];
}

function buildEnrichedTxtContent(
  llm: VideoForLLM,
  meta: VideoMeta
): string {
  return `LLM_Title: ${llm.title}

LLM_Description: ${llm.description}

LLM_Hashtags: ${llm.hashtags}

LLM_Transcription: ${llm.transcription}

-----

Title: ${meta.title}

Description: ${meta.description}

Hashtags: ${meta.hashtags}

Transcription: ${meta.transcription}

Views: ${meta.views.toLocaleString("en-US")}

Likes: ${meta.likes.toLocaleString("en-US")}

Link: ${meta.videoUrl}

Date: ${meta.publishDate}`;
}

const SYSTEM_PROMPT = `You are a social media content specialist. You receive video metadata (title, description, hashtags, transcription) and must return enriched versions that are unique, engaging, and optimized for reach on TikTok/Reels.

Rules:
- Rewrite the title to be more engaging and click-worthy while preserving the core topic
- Rewrite the description to be more compelling, adding relevant context
- Keep existing relevant hashtags and add 3-5 new trending/niche hashtags to increase discoverability
- Rewrite the transcription slightly to make it feel fresh while preserving the original meaning
- If transcription starts with "ERRO:", return it unchanged
- Return ONLY valid JSON in the exact format specified
- Process ALL items in the array and return ALL of them with the same videoId`;

const PROMPT_FILE = path.join(process.cwd(), "ai-prompt.txt");

function getSystemPrompt(): string {
  try {
    if (fs.existsSync(PROMPT_FILE)) {
      return fs.readFileSync(PROMPT_FILE, "utf-8");
    }
  } catch { /* fallback */ }
  return SYSTEM_PROMPT;
}

async function callOpenAI(videos: VideoForLLM[]): Promise<LLMResponse> {
  const userPrompt = `Process the following videos and return enriched versions:\n\n${JSON.stringify({ videos }, null, 2)}\n\nReturn JSON with format: { "videos": [{ "videoId": "...", "title": "...", "description": "...", "hashtags": "...", "transcription": "..." }] }`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: getSystemPrompt() },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 16000,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty response");

  return JSON.parse(content) as LLMResponse;
}

const BATCH_SIZE = 10;

export async function POST(request: NextRequest) {
  const debugLogs: string[] = [];

  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { videos, videosMeta } = body as { videos: VideoForLLM[]; videosMeta: VideoMeta[] };

    if (!Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json({ error: "No videos provided." }, { status: 400 });
    }

    debugLogs.push(`[INPUT] ${videos.length} video(s) to enrich (batch size: ${BATCH_SIZE})`);

    // Build lookup maps
    const metaMap = new Map<string, VideoMeta>();
    for (const m of videosMeta || []) {
      metaMap.set(m.videoId, m);
    }

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    const allLlmVideos: VideoForLLM[] = [];
    const savedFiles: string[] = [];
    const errors: string[] = [];

    // Process in batches to avoid OpenAI timeout on large payloads
    const totalBatches = Math.ceil(videos.length / BATCH_SIZE);

    for (let b = 0; b < totalBatches; b++) {
      const batchStart = b * BATCH_SIZE;
      const batch = videos.slice(batchStart, batchStart + BATCH_SIZE);
      debugLogs.push(`[BATCH ${b + 1}/${totalBatches}] Processing ${batch.length} video(s)...`);

      // Call OpenAI with retry for this batch
      let batchResult: LLMResponse | null = null;
      try {
        batchResult = await callOpenAI(batch);
      } catch (firstErr) {
        debugLogs.push(`[BATCH ${b + 1}] First attempt failed: ${firstErr instanceof Error ? firstErr.message : "unknown"}, retrying...`);
        try {
          batchResult = await callOpenAI(batch);
        } catch (retryErr) {
          const msg = retryErr instanceof Error ? retryErr.message : "unknown";
          debugLogs.push(`[BATCH ${b + 1}] Retry failed: ${msg}`);
          errors.push(`Batch ${b + 1} failed: ${msg}`);
          // Continue to next batch instead of aborting
          continue;
        }
      }

      if (!batchResult || !Array.isArray(batchResult.videos)) {
        debugLogs.push(`[BATCH ${b + 1}] Invalid LLM response — skipping`);
        errors.push(`Batch ${b + 1}: invalid LLM response`);
        continue;
      }

      debugLogs.push(`[BATCH ${b + 1}] LLM returned ${batchResult.videos.length} enriched item(s)`);

      // Save enriched files for this batch
      for (const llmItem of batchResult.videos) {
        try {
          const meta = metaMap.get(llmItem.videoId);
          if (!meta) {
            debugLogs.push(`[SKIP] videoId ${llmItem.videoId} not found in videosMeta`);
            continue;
          }

          const safeName = sanitizeFilename(meta.title);
          if (!safeName) {
            debugLogs.push(`[SKIP] empty filename for videoId ${llmItem.videoId}`);
            continue;
          }

          const prefix = buildFilePrefix(meta.views, meta.publishDate);
          const txtContent = buildEnrichedTxtContent(llmItem, meta);
          const txtPath = path.join(DOWNLOAD_DIR, `${prefix}${safeName}.txt`);
          fs.writeFileSync(txtPath, txtContent, "utf-8");
          savedFiles.push(`${prefix}${safeName}.txt`);
          debugLogs.push(`[SAVED] ${prefix}${safeName}.txt (${txtContent.length} chars)`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          errors.push(msg);
          debugLogs.push(`[ERROR] ${msg}`);
        }
      }

      allLlmVideos.push(...batchResult.videos);
    }

    debugLogs.push(`[RESULT] saved=${savedFiles.length}, errors=${errors.length}, totalBatches=${totalBatches}`);
    return NextResponse.json({ savedFiles, errors, debugLogs, downloadDir: DOWNLOAD_DIR, llmVideos: allLlmVideos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg, debugLogs }, { status: 500 });
  }
}
