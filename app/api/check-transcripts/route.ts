import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

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

function extractTranscription(content: string): string {
  const match = content.match(/^Transcription:\s*(.*)$/m);
  if (!match) return "";
  // Transcription field may span multiple lines until the next field or end
  const startIdx = content.indexOf(match[0]) + "Transcription: ".length;
  const rest = content.substring(startIdx);
  // Find next field boundary (a line starting with "Views:" or "-----" or end of file)
  const nextField = rest.search(/^(Views:|-----)/m);
  if (nextField === -1) return rest.trim();
  return rest.substring(0, nextField).trim();
}

export async function POST(request: NextRequest) {
  try {
    const { videos } = await request.json() as {
      videos: { title: string; videoUrl: string }[];
    };

    if (!Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json({ error: "No videos provided." }, { status: 400 });
    }

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      return NextResponse.json({
        results: videos.map((v) => ({ videoUrl: v.videoUrl, found: false, transcription: null })),
      });
    }

    const allFiles = fs.readdirSync(DOWNLOAD_DIR);

    const results = videos.map((v) => {
      const safeName = sanitizeFilename(v.title);
      if (!safeName) return { videoUrl: v.videoUrl, found: false, transcription: null };

      // Find txt files that start with this safeName
      const matches = allFiles.filter(
        (f) => f.startsWith(safeName) && f.endsWith(".txt")
      );

      if (matches.length === 1) {
        // Exact match — read transcription from file
        const content = fs.readFileSync(path.join(DOWNLOAD_DIR, matches[0]), "utf-8");
        const transcription = extractTranscription(content);
        return { videoUrl: v.videoUrl, found: true, transcription };
      }

      // 0 matches or 2+ matches (ambiguous) — mark as not found
      return { videoUrl: v.videoUrl, found: false, transcription: null };
    });

    return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
