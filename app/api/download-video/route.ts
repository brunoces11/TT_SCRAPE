import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

export const maxDuration = 300;

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

export async function POST(req: NextRequest) {
  try {
    const { videoUrls, titles } = await req.json();

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "Nenhuma URL fornecida." }, { status: 400 });
    }

    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    const results: { url: string; status: string; filename?: string; error?: string }[] = [];

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
          results.push({ url, status: "failed", error: "Arquivo não encontrado após download" });
          continue;
        }

        const tempPath = path.join(DOWNLOAD_DIR, tempFound);
        const safeName = sanitizeFilename(rawTitle) || videoId;
        const finalPath = path.join(DOWNLOAD_DIR, `${safeName}.mp4`);

        // Step 2: Convert to H.264 with ffmpeg
        // - strip metadata (-map_metadata -1)
        // - pixel shift 1% (scale+crop)
        // - minimal noise (noise alls=3)
        // - 1% slower (setpts=1.01*PTS + atempo=0.99)
        // - audio pitch shift 1% (asetrate+aresample)
        const ffmpegCmd = `ffmpeg -y -i "${tempPath}" -map_metadata -1 -vf "scale=iw*1.01:ih*1.01,crop=iw/1.01:ih/1.01,noise=alls=3:allf=t,setpts=1.01*PTS" -af "atempo=0.99,asetrate=44100*1.01,aresample=44100" -c:v libx264 -preset fast -crf 23 -c:a aac -movflags +faststart "${finalPath}"`;
        await execAsync(ffmpegCmd, { timeout: 300000 });

        // Remove temp file
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }

        results.push({ url, status: "ok", filename: `${safeName}.mp4` });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        results.push({ url, status: "failed", error: msg });
      }
    }

    const ok = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({
      message: `Download concluído: ${ok} com sucesso, ${failed} falha(s). Pasta: ${DOWNLOAD_DIR}`,
      downloadDir: DOWNLOAD_DIR,
      results,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
