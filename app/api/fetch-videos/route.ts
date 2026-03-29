import { NextRequest, NextResponse } from "next/server";
import { runActorAndGetResults } from "@/lib/apify";
import { normalizeChannelVideos } from "@/lib/normalize";
import { saveSearchToXls, getBlacklist } from "@/lib/xls";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrls, xlsLabel } = body;

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: "No URLs provided." }, { status: 400 });
    }

    const actorId = "clockworks/tiktok-video-scraper";
    const input = { postURLs: videoUrls };

    const rawItems = await runActorAndGetResults(actorId, input);
    const allRows = normalizeChannelVideos(rawItems);

    const blacklist = getBlacklist();
    const rows = allRows.filter((r) => !blacklist.has(r.videoUrl));
    rows.sort((a, b) => b.views - a.views);

    let savedFile = "";
    try {
      const label = xlsLabel || "batch_upload";
      const xlsRows = rows.map((r) => ({
        video_title: r.title,
        views: r.views,
        description: r.description,
        likes: r.likes,
        hashtags: r.hashtags.join(", "),
        video_url: r.videoUrl,
        comments: r.comments ?? "",
        publish_date: r.publishDate ?? "",
      }));
      savedFile = saveSearchToXls(label, xlsRows);
    } catch (xlsErr) {
      console.error("Error saving XLS:", xlsErr);
    }

    return NextResponse.json({ rows, savedFile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Error fetching video data: ${message}` }, { status: 500 });
  }
}
