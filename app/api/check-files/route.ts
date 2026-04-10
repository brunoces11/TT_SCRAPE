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

const MIN_MP3_SIZE = 1024;  // 1KB
const MIN_MP4_SIZE = 1024;  // 1KB

export async function POST(request: NextRequest) {
  try {
    const { videos } = await request.json() as {
      videos: { title: string; videoUrl: string; views?: number; publishDate?: string }[];
    };

    if (!Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json({ error: "No videos provided." }, { status: 400 });
    }

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      return NextResponse.json({
        results: videos.map((v) => ({
          videoUrl: v.videoUrl,
          hasTxt: false,
          hasMp3: false,
          hasMp4: false,
        })),
      });
    }

    const results = videos.map((v) => {
      const safeName = sanitizeFilename(v.title);
      if (!safeName) {
        return { videoUrl: v.videoUrl, hasTxt: false, hasMp3: false, hasMp4: false };
      }

      const prefix = buildFilePrefix(v.views || 0, v.publishDate || "");
      const baseName = `${prefix}${safeName}`;

      const txtPath = path.join(DOWNLOAD_DIR, `${baseName}.txt`);
      const mp3Path = path.join(DOWNLOAD_DIR, `${baseName}.mp3`);
      const mp4Path = path.join(DOWNLOAD_DIR, `${baseName}.mp4`);

      let hasTxt = false;
      let hasMp3 = false;
      let hasMp4 = false;

      try {
        const txtStat = fs.statSync(txtPath);
        hasTxt = txtStat.size > 0;
      } catch { /* not found */ }

      try {
        const mp3Stat = fs.statSync(mp3Path);
        hasMp3 = mp3Stat.size >= MIN_MP3_SIZE;
      } catch { /* not found */ }

      try {
        const mp4Stat = fs.statSync(mp4Path);
        hasMp4 = mp4Stat.size >= MIN_MP4_SIZE;
      } catch { /* not found */ }

      return { videoUrl: v.videoUrl, hasTxt, hasMp3, hasMp4 };
    });

    return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
