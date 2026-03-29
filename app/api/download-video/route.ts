import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

export const maxDuration = 600;

const execAsync = promisify(exec);

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");

function sanitizeFilename(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9]/g, "_")  // tudo que não é alfanumérico vira _
    .replace(/_+/g, "_")            // múltiplos _ viram um só
    .replace(/^_|_$/g, "")          // remove _ no início/fim
    .substring(0, 100);             // limita tamanho
}

function generateRandomParams() {
  return {
    crf: Math.floor(Math.random() * 5) + 28,           // 28-32 (próximo do original TikTok)
    scaleFactor: 1.005 + Math.random() * 0.01,          // 1.005-1.015 (sutil)
    noise: Math.floor(Math.random() * 2) + 1,           // 1-2 (mínimo para mudar hash)
    speed: 0.99 + Math.random() * 0.02,                 // 0.99-1.01 (variação mínima)
    pitch: 0.995 + Math.random() * 0.01,                // 0.995-1.005 (variação mínima)
  };
}

export async function POST(req: NextRequest) {
  try {
    const { videoUrls, titles, mode } = await req.json();

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "No URL provided." }, { status: 400 });
    }

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    const results: { url: string; status: string; filename?: string; error?: string; variant?: string }[] = [];

    for (let i = 0; i < videoUrls.length; i++) {
      const url = videoUrls[i];
      const rawTitle = titles?.[i] || "";

      try {
        // Step 1: Download with yt-dlp to a temp file
        const idMatch = url.match(/\/video\/(\d+)/);
        const videoId = idMatch ? idMatch[1] : `video_${i}`;
        const tempFile = path.join(DOWNLOAD_DIR, `${videoId}_temp.%(ext)s`);

        const downloadCmd = `yt-dlp --no-playlist --windows-filenames -o "${tempFile}" "${url}"`;
        await execAsync(downloadCmd, { timeout: 120000 });

        // Find the temp downloaded file
        const files = fs.readdirSync(DOWNLOAD_DIR);
        const tempFound = files.find((f) => f.startsWith(`${videoId}_temp`));

        if (!tempFound) {
          results.push({ url, status: "failed", error: "File not found after download" });
          continue;
        }

        const tempPath = path.join(DOWNLOAD_DIR, tempFound);
        const safeName = sanitizeFilename(rawTitle) || videoId;

        if (mode === "x5") {
          // --- x5 mode: original copy + 5 ffmpeg variants ---

          // Copy original (no ffmpeg processing)
          const origPath = path.join(DOWNLOAD_DIR, `${safeName}_ORIG.mp4`);
          fs.copyFileSync(tempPath, origPath);
          results.push({ url, status: "ok", filename: `${safeName}_ORIG.mp4`, variant: "ORIG" });

          // Generate 5 variants
          for (let v = 1; v <= 5; v++) {
            const variantLabel = `v${String(v).padStart(2, "0")}`;
            const variantPath = path.join(DOWNLOAD_DIR, `${safeName}_${variantLabel}.mp4`);
            try {
              const p = generateRandomParams();
              const ffmpegCmd = `ffmpeg -y -i "${tempPath}" -map_metadata -1 -vf "scale=iw*${p.scaleFactor}:ih*${p.scaleFactor},crop=iw/${p.scaleFactor}:ih/${p.scaleFactor},noise=alls=${p.noise}:allf=t,setpts=${(1 / p.speed).toFixed(6)}*PTS" -af "atempo=${p.speed.toFixed(4)},asetrate=44100*${p.pitch.toFixed(4)},aresample=44100" -c:v libx264 -preset medium -crf ${p.crf} -c:a aac -b:a 64k -movflags +faststart "${variantPath}"`;
              await execAsync(ffmpegCmd, { timeout: 600000 });
              results.push({ url, status: "ok", filename: `${safeName}_${variantLabel}.mp4`, variant: variantLabel });
            } catch (varErr: unknown) {
              const varMsg = varErr instanceof Error ? varErr.message : "Unknown error";
              console.error(`Error generating variant ${variantLabel} for ${safeName}:`, varMsg);
              results.push({ url, status: "failed", error: varMsg, variant: variantLabel });
            }
          }

          // Remove temp file after all variants
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } else {
          // --- Default mode: existing behavior unchanged ---
          const finalPath = path.join(DOWNLOAD_DIR, `${safeName}.mp4`);

          // Step 2: Convert to H.264 with ffmpeg
          // - strip metadata (-map_metadata -1)
          // - pixel shift 1% (scale+crop)
          // - minimal noise (noise alls=3)
          // - 1% slower (setpts=1.01*PTS + atempo=0.99)
          // - audio pitch shift 1% (asetrate+aresample)
          const ffmpegCmd = `ffmpeg -y -i "${tempPath}" -map_metadata -1 -vf "scale=iw*1.01:ih*1.01,crop=iw/1.01:ih/1.01,noise=alls=3:allf=t,setpts=1.01*PTS" -af "atempo=0.99,asetrate=44100*1.01,aresample=44100" -c:v libx264 -preset fast -crf 23 -c:a aac -movflags +faststart "${finalPath}"`;
          await execAsync(ffmpegCmd, { timeout: 600000 });

          // Remove temp file
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }

          results.push({ url, status: "ok", filename: `${safeName}.mp4` });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.push({ url, status: "failed", error: msg });
      }
    }

    const ok = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({
      message: `Download completed: ${ok} succeeded, ${failed} failure(s). Folder: ${DOWNLOAD_DIR}`,
      downloadDir: DOWNLOAD_DIR,
      results,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
