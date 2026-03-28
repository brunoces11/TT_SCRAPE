"use client";

import { useState } from "react";
import ChannelForm from "@/components/ChannelForm";
import type { SearchParams } from "@/components/ChannelForm";
import VideoResultsTable from "@/components/VideoResultsTable";
import TranscriptResultsTable from "@/components/TranscriptResultsTable";
import SavedSearches from "@/components/SavedSearches";
import { ChannelVideoRow, TranscriptRow } from "@/types";
import { normalizeTranscripts } from "@/lib/normalize";

export default function Home() {
  const [channelRows, setChannelRows] = useState<ChannelVideoRow[]>([]);
  const [selectedVideoUrls, setSelectedVideoUrls] = useState<string[]>([]);
  const [transcriptRows, setTranscriptRows] = useState<TranscriptRow[]>([]);
  const [isFetchingChannel, setIsFetchingChannel] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [detailLogs, setDetailLogs] = useState<string[]>([]);
  const [currentXlsFile, setCurrentXlsFile] = useState<string>("");
  const [singleVideoUrl, setSingleVideoUrl] = useState("");
  const [singleVideoError, setSingleVideoError] = useState<string | null>(null);
  const [isDownloadingX5, setIsDownloadingX5] = useState(false);
  const [downloadX5Status, setDownloadX5Status] = useState<string | null>(null);

  // ─── Function 1: Fetch Channel ───
  const handleFetchChannel = async (params: SearchParams) => {
    setError(null);
    setSingleVideoUrl("");
    setSingleVideoError(null);
    setIsFetchingChannel(true);
    setChannelRows([]);
    setSelectedVideoUrls([]);
    setTranscriptRows([]);
    setDetailLogs([]);

    try {
      const res = await fetch("/api/fetch-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error fetching data.");
        return;
      }

      setChannelRows(data.rows || []);
      setSelectedVideoUrls((data.rows || []).map((r: ChannelVideoRow) => r.videoUrl));
      if (data.savedFile) setCurrentXlsFile(data.savedFile);
    } catch {
      setError("Network error connecting to server.");
    } finally {
      setIsFetchingChannel(false);
    }
  };

  // ─── Helper: get metadata for selected URLs ───
  const getSelectedMeta = () =>
    selectedVideoUrls.map((url) => {
      const row = channelRows.find((r) => r.videoUrl === url);
      return {
        title: row?.title || "",
        views: row?.views || 0,
        likes: row?.likes || 0,
        comments: row?.comments || 0,
        description: row?.description || "",
        hashtags: row?.hashtags?.join(", ") || "",
        videoUrl: url,
        publishDate: row?.publishDate || "",
      };
    });

  // ─── Function 2: Fetch Transcripts + save .txt ───
  const handleTranscribe = async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Select at least one video.");
      return;
    }

    setError(null);
    setIsTranscribing(true);
    setTranscriptRows([]);
    setDetailLogs([]);
    setTranscriptStatus(`Transcribing ${selectedVideoUrls.length} video(s)... this may take a few minutes`);

    try {
      const res = await fetch("/api/transcribe-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrls: selectedVideoUrls,
          videosMeta: getSelectedMeta(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error fetching transcripts.");
        if (data.debugLogs) setDetailLogs(data.debugLogs);
        setTranscriptStatus(null);
        return;
      }

      // Handle Apify actor failure (returned as 200 with actorFailed flag)
      if (data.actorFailed) {
        setTranscriptStatus("⚠️ Transcription service failed to process video(s) — may be private, removed, or unsupported");
        if (data.debugLogs) setDetailLogs(data.debugLogs);
        return;
      }

      const normalized = normalizeTranscripts(data.rawItems || [], channelRows);
      setTranscriptRows(normalized);

      // Collect logs for UI display
      const logs: string[] = [];
      if (data.debugLogs) {
        const relevant = (data.debugLogs as string[]).filter(
          (l: string) => l.includes("SKIP") || l.includes("ERROR") || l.includes("SAVED") || l.includes("RESULT") || l.includes("hasTranscript")
        );
        logs.push(...relevant);
      }
      if (data.errors?.length > 0) {
        logs.push(...(data.errors as string[]).map((e: string) => `❌ ${e}`));
      }
      setDetailLogs(logs);

      const saved = data.savedFiles?.length || 0;
      const noTranscript = data.noTranscript?.length || 0;
      const errorCount = data.errors?.length || 0;
      const total = selectedVideoUrls.length;

      // Build clear status message
      const parts: string[] = [];
      if (saved > 0) parts.push(`✅ ${saved} transcript(s) downloaded`);
      if (noTranscript > 0) parts.push(`📭 ${noTranscript} without transcript`);
      if (errorCount > 0) parts.push(`❌ ${errorCount} error(s)`);

      let statusMsg = `Completed (${total} video(s)): ${parts.join(" · ")}`;
      if (saved > 0) statusMsg += ` — .txt file(s) saved to /downloads`;
      if (saved === 0 && noTranscript > 0 && errorCount === 0) {
        statusMsg += ` — no video has a transcript available (no speech/subtitles detected)`;
      }
      setTranscriptStatus(statusMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(`Network error: ${msg}`);
      setTranscriptStatus(null);
    } finally {
      setIsTranscribing(false);
    }
  };

  // ─── Download Videos via yt-dlp ───
  const handleDownloadVideos = async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Select at least one video to download.");
      return;
    }

    setError(null);
    setIsDownloading(true);
    setDownloadStatus(`Downloading ${selectedVideoUrls.length} video(s)... this may take a few minutes`);

    try {
      const res = await fetch("/api/download-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrls: selectedVideoUrls,
          titles: getSelectedMeta().map((m) => m.title),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error downloading videos.");
        setDownloadStatus(null);
        return;
      }

      // Show per-video results in logs
      if (data.results) {
        const dlLogs = (data.results as { url: string; status: string; filename?: string; error?: string }[]).map(
          (r) => r.status === "ok" ? `✅ ${r.filename}` : `❌ ${r.url.substring(0, 60)} — ${r.error}`
        );
        setDetailLogs((prev) => [...prev, ...dlLogs]);
      }

      setDownloadStatus(data.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(`Network error downloading videos: ${msg}`);
      setDownloadStatus(null);
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── Download All (transcripts + videos) — resilient ───
  const handleDownloadAll = async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Select at least one video.");
      return;
    }

    setIsDownloadingAll(true);
    setError(null);
    setDetailLogs([]);

    // Step 1: Transcripts (errors won't block step 2)
    try {
      await handleTranscribe();
    } catch {
      // continue even if transcription fails
    }

    // Step 2: Videos (always runs)
    try {
      await handleDownloadVideos();
    } catch {
      // continue
    }

    setIsDownloadingAll(false);
  };

  // ─── Download All x5 (transcripts + 5 variants per video) ───
  const handleDownloadX5 = async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Select at least one video.");
      return;
    }

    setIsDownloadingX5(true);
    setError(null);
    setDetailLogs([]);
    setDownloadX5Status(`Processing ${selectedVideoUrls.length} video(s) x5... this may take several minutes`);

    // Step 1: Transcripts (errors won't block step 2)
    try {
      await handleTranscribe();
    } catch {
      // continue even if transcription fails
    }

    // Step 2: Download each video individually with mode x5
    let totalOk = 0;
    let totalFailed = 0;
    const meta = getSelectedMeta();

    for (let i = 0; i < selectedVideoUrls.length; i++) {
      const url = selectedVideoUrls[i];
      const title = meta[i]?.title || "";

      setDownloadX5Status(`Processing video ${i + 1} of ${selectedVideoUrls.length} (x5)...`);

      try {
        const res = await fetch("/api/download-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrls: [url],
            titles: [title],
            mode: "x5",
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setDetailLogs((prev) => [...prev, `❌ [DOWNLOAD] Video ${i + 1}: ${data.error || "Unknown error"}`]);
          totalFailed++;
          continue;
        }

        if (data.results) {
          const dlLogs = (data.results as { url: string; status: string; filename?: string; error?: string; variant?: string }[]).map(
            (r) => r.status === "ok" ? `✅ ${r.filename}` : `❌ [FFMPEG] ${r.filename || r.variant || "?"}: ${r.error}`
          );
          setDetailLogs((prev) => [...prev, ...dlLogs]);

          const okCount = data.results.filter((r: { status: string }) => r.status === "ok").length;
          const failCount = data.results.filter((r: { status: string }) => r.status === "failed").length;
          totalOk += okCount;
          totalFailed += failCount;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        setDetailLogs((prev) => [...prev, `❌ [DOWNLOAD] Video ${i + 1}: Network error — ${msg}`]);
        totalFailed++;
      }
    }

    setDownloadX5Status(`Download x5 completed: ${totalOk} file(s) succeeded, ${totalFailed} failure(s). Folder: downloads/`);
    setIsDownloadingX5(false);
  };

  // ─── Delete selected rows from UI + XLSX ───
  const handleDeleteSelected = async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Select at least one video to delete.");
      return;
    }

    // Remove from UI immediately
    const remaining = channelRows.filter((r) => !selectedVideoUrls.includes(r.videoUrl));
    setChannelRows(remaining);
    setSelectedVideoUrls([]);

    // Remove from XLSX if we have a file reference
    if (currentXlsFile) {
      try {
        const res = await fetch("/api/saved-searches", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: currentXlsFile, videoUrls: selectedVideoUrls }),
        });
        const data = await res.json();
        if (res.ok) {
          setDetailLogs((prev) => [...prev, `🗑️ ${data.message}`]);
        } else {
          setDetailLogs((prev) => [...prev, `❌ Error deleting from XLSX: ${data.error}`]);
        }
      } catch {
        setDetailLogs((prev) => [...prev, `❌ Network error deleting from XLSX`]);
      }
    }
  };

  const TIKTOK_VIDEO_REGEX = /tiktok\.com\/@[\w.-]+\/video\/(\d+)/;

  const handleSingleVideoSubmit = () => {
    setSingleVideoError(null);
    const match = singleVideoUrl.trim().match(TIKTOK_VIDEO_REGEX);
    if (!match) {
      setSingleVideoError("Invalid URL. Use the format: https://www.tiktok.com/@username/video/1234567890");
      return;
    }
    const videoId = match[1];
    const url = singleVideoUrl.trim();

    // Clear previous state
    setTranscriptRows([]);
    setTranscriptStatus(null);
    setDownloadStatus(null);
    setDownloadX5Status(null);
    setDetailLogs([]);
    setError(null);

    // Cria ChannelVideoRow sintético
    const row: ChannelVideoRow = {
      videoId,
      title: `Video ${videoId}`,
      description: "",
      views: 0,
      likes: 0,
      hashtags: [],
      videoUrl: url,
    };

    setChannelRows([row]);
    setSelectedVideoUrls([url]);
  };

  const handleBatchFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        setSingleVideoError("The file is empty.");
        return;
      }

      const valid: { url: string; videoId: string }[] = [];
      const invalidLines: number[] = [];

      lines.forEach((line, i) => {
        const match = line.match(TIKTOK_VIDEO_REGEX);
        if (match) {
          valid.push({ url: line, videoId: match[1] });
        } else {
          invalidLines.push(i + 1);
        }
      });

      if (valid.length === 0) {
        setSingleVideoError(`No valid TikTok URLs found. Invalid lines: ${invalidLines.join(", ")}`);
        return;
      }

      setSingleVideoError(invalidLines.length > 0 ? `Loaded ${valid.length} URL(s). Skipped ${invalidLines.length} invalid line(s).` : null);

      setTranscriptRows([]);
      setTranscriptStatus(null);
      setDownloadStatus(null);
      setDownloadX5Status(null);
      setDetailLogs([]);
      setError(null);

      const uniqueUrls = [...new Set(valid.map((v) => v.url))];
      const rows: ChannelVideoRow[] = uniqueUrls.map((url) => {
        const videoId = url.match(TIKTOK_VIDEO_REGEX)![1];
        return { videoId, title: `Video ${videoId}`, description: "", views: 0, likes: 0, hashtags: [], videoUrl: url };
      });

      setChannelRows(rows);
      setSelectedVideoUrls(uniqueUrls);
    };
    reader.readAsText(file);
  };

  return (
    <main className="container">
      <h1>🎵 TikTok Scraper & Transcript Tool</h1>
      <p className="subtitle">Local research tool — extract data and transcripts from TikTok channels</p>

      {/* ─── Channel Form ─── */}
      <ChannelForm onSubmit={handleFetchChannel} isLoading={isFetchingChannel} />

      {/* ─── Single Video URL / Batch Upload ─── */}
      <div className="single-video-section">
        <div className="single-video-cols">
          <div className="single-video-row">
            <input
              type="text"
              placeholder="Paste a TikTok video URL here"
              value={singleVideoUrl}
              onChange={(e) => { setSingleVideoUrl(e.target.value); setSingleVideoError(null); }}
              disabled={isFetchingChannel}
              onKeyDown={(e) => { if (e.key === "Enter") handleSingleVideoSubmit(); }}
            />
            <button
              className="btn btn-primary"
              onClick={handleSingleVideoSubmit}
              disabled={!singleVideoUrl.trim() || isFetchingChannel}
            >
              🎬 Load video
            </button>
          </div>
          <div className="batch-upload-divider">or</div>
          <label className="btn btn-primary batch-upload-btn">
            📄 Upload .txt
            <input type="file" accept=".txt" onChange={handleBatchFileUpload} hidden />
          </label>
        </div>
        {singleVideoError && <div className="single-video-error">{singleVideoError}</div>}
      </div>

      {/* ─── Loading / Error ─── */}
      {isFetchingChannel && (
        <div className="loading">
          <div className="spinner" />
          Fetching channel data... this may take up to 2 minutes
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-dismiss">✕</button>
        </div>
      )}

      {/* ─── Action Bar (all buttons) ─── */}
      {channelRows.length > 0 && (
        <div className="action-bar">
          <div className="transcript-actions">
            <button
              className="btn btn-transcript"
              onClick={handleTranscribe}
              disabled={isTranscribing || isDownloadingX5 || selectedVideoUrls.length === 0}
            >
              {isTranscribing ? "Downloading..." : "📝 Download Transcript"}
            </button>

            <button
              className="btn btn-download"
              onClick={handleDownloadVideos}
              disabled={isDownloading || isDownloadingX5 || selectedVideoUrls.length === 0}
            >
              {isDownloading ? "Downloading..." : "⬇️ Download selected videos"}
            </button>

            <button
              className="btn btn-download-all"
              onClick={handleDownloadAll}
              disabled={isDownloadingAll || isTranscribing || isDownloading || isDownloadingX5 || selectedVideoUrls.length === 0}
            >
              {isDownloadingAll ? "Downloading all..." : "📦 Download all"}
            </button>

            <button
              className="btn btn-download-x5"
              onClick={handleDownloadX5}
              disabled={isDownloadingX5 || isDownloadingAll || isTranscribing || isDownloading || selectedVideoUrls.length === 0}
            >
              {isDownloadingX5 ? "Downloading x5..." : "🔥 Download all x5"}
            </button>

            <button
              className="btn btn-delete"
              onClick={handleDeleteSelected}
              disabled={selectedVideoUrls.length === 0}
            >
              🗑️ Delete selected
            </button>
          </div>
        </div>
      )}

      {/* ─── Download Video Status ─── */}
      {isDownloading && downloadStatus && (
        <div className="loading">
          <div className="spinner" />
          {downloadStatus}
        </div>
      )}

      {!isDownloading && downloadStatus && (
        <div className="transcript-summary">
          {downloadStatus}
        </div>
      )}

      {/* ─── Download x5 Status ─── */}
      {isDownloadingX5 && downloadX5Status && (
        <div className="loading">
          <div className="spinner" />
          {downloadX5Status}
        </div>
      )}

      {!isDownloadingX5 && downloadX5Status && (
        <div className="transcript-summary">
          {downloadX5Status}
        </div>
      )}

      {/* ─── Transcribing Loading ─── */}
      {isTranscribing && transcriptStatus && (
        <div className="loading">
          <div className="spinner" />
          {transcriptStatus}
        </div>
      )}

      {/* ─── Transcript Status Summary ─── */}
      {!isTranscribing && transcriptStatus && (
        <div className="transcript-summary">
          {transcriptStatus}
        </div>
      )}

      {/* ─── Detail Logs (visible in UI) ─── */}
      {detailLogs.length > 0 && (
        <div className="detail-logs">
          <div className="detail-logs-header">
            <span>📋 Execution log ({detailLogs.length} events)</span>
            <button onClick={() => setDetailLogs([])} className="error-dismiss">✕</button>
          </div>
          <div className="detail-logs-body">
            {detailLogs.map((log, i) => (
              <div key={i} className={`log-line ${log.includes("❌") || log.includes("ERROR") ? "log-error" : log.includes("✅") || log.includes("SAVED") ? "log-success" : "log-info"}`}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Channel Results Table ─── */}
      <VideoResultsTable
        rows={channelRows}
        selectedVideoUrls={selectedVideoUrls}
        onSelectionChange={setSelectedVideoUrls}
      />

      {/* ─── Transcript Results Table ─── */}
      <TranscriptResultsTable rows={transcriptRows} />

      {/* ─── Saved Searches ─── */}
      <SavedSearches onLoad={(rows, filename) => {
        const mapped: ChannelVideoRow[] = rows.map((r: Record<string, unknown>) => ({
          title: String(r.video_title || ""),
          views: Number(r.views) || 0,
          description: String(r.description || ""),
          likes: Number(r.likes) || 0,
          hashtags: String(r.hashtags || "").split(", ").filter(Boolean),
          videoId: String(r.video_url || "").match(/\/video\/(\d+)/)?.[1] || "",
          videoUrl: String(r.video_url || ""),
          comments: Number(r.comments) || 0,
          publishDate: String(r.publish_date || ""),
        }));
        mapped.sort((a, b) => b.views - a.views);
        setChannelRows(mapped);
        setSelectedVideoUrls(mapped.map((r) => r.videoUrl));
        setTranscriptRows([]);
        setTranscriptStatus(null);
        setDownloadStatus(null);
        setDetailLogs([]);
        if (filename) setCurrentXlsFile(filename);
      }} />
    </main>
  );
}
