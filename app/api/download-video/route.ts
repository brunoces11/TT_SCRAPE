import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

export const maxDuration = 300;

const execAsync = promisify(exec);

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");

export async function POST(req: NextRequest) {
  try {
    const { videoUrls } = await req.json();

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "Nenhuma URL fornecida." }, { status: 400 });
    }

    // Ensure downloads folder exists
    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    const results: { url: string; status: string; filename?: string; error?: string }[] = [];

    for (const url of videoUrls) {
      try {
        // Use yt-dlp to download the video
        const outputTemplate = path.join(DOWNLOAD_DIR, "%(id)s.%(ext)s");
        const cmd = `yt-dlp -f "bv[vcodec^=avc1]+ba[ext=m4a]/b[vcodec^=avc1]/bv+ba/b" --merge-output-format mp4 --recode-video mp4 --postprocessor-args "ffmpeg:-c:v libx264 -c:a aac" --no-playlist --windows-filenames -o "${outputTemplate}" "${url}"`;


        await execAsync(cmd, { timeout: 120000 });

        // Find the downloaded file (get the video ID from URL)
        const idMatch = url.match(/\/video\/(\d+)/);
        const videoId = idMatch ? idMatch[1] : null;

        let filename = "";
        if (videoId) {
          const files = fs.readdirSync(DOWNLOAD_DIR);
          const found = files.find((f) => f.startsWith(videoId));
          filename = found || "";
        }

        results.push({ url, status: "ok", filename });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        results.push({ url, status: "failed", error: msg });
      }
    }

    const ok = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({
      message: `Download concluído: ${ok} com sucesso, ${failed} falha(s)`,
      downloadDir: DOWNLOAD_DIR,
      results,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
