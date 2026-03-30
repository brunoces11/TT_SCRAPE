"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [apifyCredits, setApifyCredits] = useState<{ usedUsd: number; limitUsd: number; remainingUsd: number } | null>(null);
  const [isRunningAI, setIsRunningAI] = useState(false);
  const [runAIStatus, setRunAIStatus] = useState<string | null>(null);
  const [transcriptActors, setTranscriptActors] = useState<{ id: string; name: string; default: boolean }[]>([]);
  const [selectedTranscriptActor, setSelectedTranscriptActor] = useState<string>("");
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/apify-credits");
      if (res.ok) {
        const data = await res.json();
        setApifyCredits(data);
        return data.usedUsd as number;
      }
    } catch { /* silent */ }
    return null;
  }, []);

  useEffect(() => {
    fetchCredits();
    // Load actor config
    fetch("/api/apify-actors")
      .then((r) => r.json())
      .then((data) => {
        const actors = data.transcriptActors || [];
        setTranscriptActors(actors);
        const defaultActor = actors.find((a: { default: boolean }) => a.default);
        if (defaultActor) setSelectedTranscriptActor(defaultActor.id);
        else if (actors.length > 0) setSelectedTranscriptActor(actors[0].id);
      })
      .catch(() => {});
  }, [fetchCredits]);

  // ─── Prompt Modal helpers ───
  const handleOpenPrompt = async () => {
    try {
      const res = await fetch("/api/enrich-metadata/prompt");
      if (res.ok) {
        const data = await res.json();
        setPromptText(data.prompt || "");
      }
    } catch { /* silent */ }
    setShowPromptModal(true);
  };

  const handleSavePrompt = async () => {
    setIsSavingPrompt(true);
    try {
      await fetch("/api/enrich-metadata/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });
    } catch { /* silent */ }
    setIsSavingPrompt(false);
    setShowPromptModal(false);
  };

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

    const creditsBefore = await fetchCredits();

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
      const creditsAfter = await fetchCredits();
      if (creditsBefore != null && creditsAfter != null) {
        const spent = Math.max(0, creditsAfter - creditsBefore);
        if (spent > 0) setDetailLogs((prev) => [...prev, `💰 Apify credits used: $${spent.toFixed(4)}`]);
      }
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
  const handleTranscribe = async (urlsOverride?: string[]): Promise<TranscriptRow[]> => {
    const urls = urlsOverride || selectedVideoUrls;
    if (urls.length === 0) {
      setError("Select at least one video.");
      return [];
    }

    // Build meta for the URLs being transcribed
    const metaForUrls = urls.map((url) => {
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

    setError(null);
    setIsTranscribing(true);
    if (!urlsOverride) {
      setTranscriptRows([]);
      setDetailLogs([]);
    }
    setTranscriptStatus(`Transcribing ${urls.length} video(s)... this may take a few minutes`);

    const creditsBefore = await fetchCredits();

    try {
      const res = await fetch("/api/transcribe-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrls: urls,
          videosMeta: metaForUrls,
          actorId: selectedTranscriptActor,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error fetching transcripts.");
        if (data.debugLogs) setDetailLogs(data.debugLogs);
        setTranscriptStatus(null);
        return [];
      }

      // Handle Apify actor failure (returned as 200 with actorFailed flag)
      if (data.actorFailed) {
        setTranscriptStatus("⚠️ Transcription service failed to process video(s) — may be private, removed, or unsupported");
        if (data.debugLogs) setDetailLogs(data.debugLogs);
        return [];
      }

      const normalized = normalizeTranscripts(data.rawItems || [], channelRows);
      if (!urlsOverride) {
        setTranscriptRows(normalized);
      } else {
        // Merge new transcripts with existing ones
        setTranscriptRows((prev) => {
          const existing = new Map(prev.map((r) => [r.videoUrl, r]));
          for (const row of normalized) {
            existing.set(row.videoUrl, row);
          }
          return Array.from(existing.values());
        });
      }

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
      const total = urls.length;

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

      return normalized;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(`Network error: ${msg}`);
      setTranscriptStatus(null);
      return [];
    } finally {
      setIsTranscribing(false);
      const creditsAfter = await fetchCredits();
      if (creditsBefore != null && creditsAfter != null) {
        const spent = Math.max(0, creditsAfter - creditsBefore);
        if (spent > 0) setDetailLogs((prev) => [...prev, `💰 Apify credits used: $${spent.toFixed(4)}`]);
      }
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

    // Step 2: Videos (always runs) — preserve transcript logs
    try {
      // Don't clear error/logs — handleDownloadVideos adds to existing logs
      setIsDownloading(true);
      setDownloadStatus(`Downloading ${selectedVideoUrls.length} video(s)... this may take a few minutes`);

      const res = await fetch("/api/download-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrls: selectedVideoUrls,
          titles: getSelectedMeta().map((m) => m.title),
        }),
      });

      const data = await res.json();

      if (data.results) {
        const dlLogs = (data.results as { url: string; status: string; filename?: string; error?: string }[]).map(
          (r) => r.status === "ok" ? `✅ ${r.filename}` : `❌ ${r.url.substring(0, 60)} — ${r.error}`
        );
        setDetailLogs((prev) => [...prev, ...dlLogs]);
      }

      setDownloadStatus(data.message || null);
      setIsDownloading(false);
    } catch {
      setIsDownloading(false);
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

  // ─── Run AI: enrich metadata via LLM ───
  const handleRunAI = async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Select at least one video.");
      return;
    }

    setIsRunningAI(true);
    setError(null);
    setRunAIStatus(`Checking existing transcriptions...`);

    // Step 1: Check memory (transcriptRows) for existing transcriptions
    const memoryTranscripts = new Map(
      transcriptRows.map((r) => [r.videoUrl, r.transcript])
    );

    // Step 2: For videos not in memory, check disk via backend
    const notInMemory = selectedVideoUrls.filter((url) => !memoryTranscripts.has(url));
    const diskTranscripts = new Map<string, string>();

    if (notInMemory.length > 0) {
      try {
        const checkPayload = notInMemory.map((url) => {
          const row = channelRows.find((r) => r.videoUrl === url);
          return { title: row?.title || "", videoUrl: url };
        });
        const checkRes = await fetch("/api/check-transcripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videos: checkPayload }),
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          for (const item of checkData.results || []) {
            if (item.found && item.transcription) {
              diskTranscripts.set(item.videoUrl, item.transcription);
            }
          }
        }
      } catch {
        // If check fails, we'll just download the transcriptions
      }
    }

    // Step 3: Determine which videos still need transcription
    const faltantes = selectedVideoUrls.filter(
      (url) => !memoryTranscripts.has(url) && !diskTranscripts.has(url)
    );

    // Step 4: Transcribe only the missing ones
    let newTranscripts: TranscriptRow[] = [];
    if (faltantes.length > 0) {
      setRunAIStatus(`Transcribing ${faltantes.length} missing video(s)...`);
      try {
        newTranscripts = await handleTranscribe(faltantes);
      } catch {
        // continue even if transcription fails
      }
    }

    // Step 5: Combine all transcription sources (memory + disk + new)
    const allTranscriptions = new Map<string, string>();
    for (const [url, t] of memoryTranscripts) allTranscriptions.set(url, t);
    for (const [url, t] of diskTranscripts) allTranscriptions.set(url, t);
    for (const row of newTranscripts) allTranscriptions.set(row.videoUrl, row.transcript);

    // Step 6: Build payload
    setRunAIStatus(`Sending ${selectedVideoUrls.length} video(s) to AI...`);

    const videosForLLM = selectedVideoUrls.map((url) => {
      const row = channelRows.find((r) => r.videoUrl === url);
      const transcription = allTranscriptions.get(url) || "ERRO: Transcription not available";
      return {
        videoId: row?.videoId || "",
        title: row?.title || "",
        description: row?.description || "",
        hashtags: row?.hashtags?.join(", ") || "",
        transcription,
      };
    });

    const videosMetaFull = selectedVideoUrls.map((url) => {
      const row = channelRows.find((r) => r.videoUrl === url);
      const transcription = allTranscriptions.get(url) || "ERRO: Transcription not available";
      return {
        videoId: row?.videoId || "",
        title: row?.title || "",
        views: row?.views || 0,
        likes: row?.likes || 0,
        description: row?.description || "",
        hashtags: row?.hashtags?.join(", ") || "",
        videoUrl: url,
        publishDate: row?.publishDate || "",
        transcription,
      };
    });

    // Step 5: Call enrich-metadata API
    try {
      const res = await fetch("/api/enrich-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos: videosForLLM, videosMeta: videosMetaFull }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error enriching metadata.");
        if (data.debugLogs) setDetailLogs((prev) => [...prev, ...(data.debugLogs as string[])]);
        setRunAIStatus(null);
        setIsRunningAI(false);
        return;
      }

      if (data.debugLogs) {
        setDetailLogs((prev) => [...prev, ...(data.debugLogs as string[])]);
      }

      const saved = data.savedFiles?.length || 0;
      const errorCount = data.errors?.length || 0;
      setRunAIStatus(`AI enrichment completed: ${saved} file(s) saved, ${errorCount} error(s). Folder: downloads/`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`Network error: ${msg}`);
      setRunAIStatus(null);
    } finally {
      setIsRunningAI(false);
    }
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
  const TIKTOK_URL_REGEX = /tiktok\.com/;

  const handleSingleVideoSubmit = async () => {
    setSingleVideoError(null);
    const match = singleVideoUrl.trim().match(TIKTOK_VIDEO_REGEX);
    if (!match) {
      setSingleVideoError("Invalid URL. Use the format: https://www.tiktok.com/@username/video/1234567890");
      return;
    }
    const url = singleVideoUrl.trim();

    // Clear previous state
    setTranscriptRows([]);
    setTranscriptStatus(null);
    setDownloadStatus(null);
    setDownloadX5Status(null);
    setDetailLogs([]);
    setError(null);
    setIsFetchingChannel(true);
    setChannelRows([]);
    setSelectedVideoUrls([]);

    try {
      const res = await fetch("/api/fetch-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrls: [url], xlsLabel: "single_video" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error fetching video data.");
        return;
      }

      setChannelRows(data.rows || []);
      setSelectedVideoUrls((data.rows || []).map((r: ChannelVideoRow) => r.videoUrl));
      if (data.savedFile) setCurrentXlsFile(data.savedFile);
    } catch {
      setError("Network error fetching video data.");
    } finally {
      setIsFetchingChannel(false);
    }
  };

  const handleBatchFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const fileName = file.name.replace(/\.txt$/i, "");

    const reader = new FileReader();
    reader.onload = async () => {
      const text = reader.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        setSingleVideoError("The file is empty.");
        return;
      }

      const valid: string[] = [];
      const invalidLines: number[] = [];

      lines.forEach((line, i) => {
        if (TIKTOK_URL_REGEX.test(line)) {
          valid.push(line);
        } else {
          invalidLines.push(i + 1);
        }
      });

      if (valid.length === 0) {
        setSingleVideoError(`No valid TikTok URLs found. Invalid lines: ${invalidLines.join(", ")}`);
        return;
      }

      if (invalidLines.length > 0) {
        setSingleVideoError(`Skipped ${invalidLines.length} invalid line(s). Fetching ${valid.length} video(s)...`);
      } else {
        setSingleVideoError(null);
      }

      // Clear state and start fetching
      setTranscriptRows([]);
      setTranscriptStatus(null);
      setDownloadStatus(null);
      setDownloadX5Status(null);
      setDetailLogs([]);
      setError(null);
      setIsFetchingChannel(true);
      setChannelRows([]);
      setSelectedVideoUrls([]);

      try {
        const res = await fetch("/api/fetch-videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoUrls: valid, xlsLabel: fileName }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Error fetching video data.");
          return;
        }

        setChannelRows(data.rows || []);
        setSelectedVideoUrls((data.rows || []).map((r: ChannelVideoRow) => r.videoUrl));
        if (data.savedFile) setCurrentXlsFile(data.savedFile);
      } catch {
        setError("Network error fetching video data.");
      } finally {
        setIsFetchingChannel(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <main className="container">
      <div className="header-row">
        <div>
          <h1>🎵 TikTok Scraper & Transcript Tool</h1>
          <p className="subtitle">Local research tool — extract data and transcripts from TikTok channels</p>
        </div>
        <div className="header-controls">
          <div className="header-control-item">
            <span className="header-control-label">Config</span>
            <button className="btn btn-prompt" onClick={handleOpenPrompt} title="Edit AI prompt">
              Prompt
            </button>
          </div>
          {transcriptActors.length > 0 && (
            <div className="header-control-item">
              <span className="header-control-label">Transcription Actor</span>
              <select
                className="actor-selector"
                value={selectedTranscriptActor}
                onChange={(e) => setSelectedTranscriptActor(e.target.value)}
                title="Transcript actor"
              >
                {transcriptActors.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}
          {apifyCredits && (
            <div className="header-control-item">
              <span className="header-control-label">Credits</span>
              <div className="credits-badge" title={`Used: $${apifyCredits.usedUsd.toFixed(2)} / Limit: $${apifyCredits.limitUsd.toFixed(2)}`}>
                💳 ${apifyCredits.remainingUsd.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Prompt Modal ─── */}
      {showPromptModal && (
        <div className="modal-overlay" onClick={() => setShowPromptModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>Edit AI Prompt</span>
              <button onClick={() => setShowPromptModal(false)} className="error-dismiss">✕</button>
            </div>
            <textarea
              className="prompt-textarea"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={16}
              placeholder="Enter the system prompt for AI enrichment..."
            />
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleSavePrompt} disabled={isSavingPrompt}>
                {isSavingPrompt ? "Saving..." : "Save"}
              </button>
              <button className="btn btn-csv" onClick={() => setShowPromptModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
              onClick={() => handleTranscribe()}
              disabled={isTranscribing || isDownloadingX5 || isRunningAI || selectedVideoUrls.length === 0}
            >
              {isTranscribing ? "Downloading..." : "📝 Download Transcript"}
            </button>

            <button
              className="btn btn-download"
              onClick={handleDownloadVideos}
              disabled={isDownloading || isDownloadingX5 || isRunningAI || selectedVideoUrls.length === 0}
            >
              {isDownloading ? "Downloading..." : "⬇️ Download selected videos"}
            </button>

            <button
              className="btn btn-run-ai"
              onClick={handleRunAI}
              disabled={isRunningAI || isDownloadingAll || isTranscribing || isDownloading || isDownloadingX5 || selectedVideoUrls.length === 0}
            >
              {isRunningAI ? "Running AI..." : "🤖 Run AI"}
            </button>

            <button
              className="btn btn-download-all"
              onClick={handleDownloadAll}
              disabled={isDownloadingAll || isTranscribing || isDownloading || isDownloadingX5 || isRunningAI || selectedVideoUrls.length === 0}
            >
              {isDownloadingAll ? "Downloading all..." : "📦 Download all"}
            </button>

            <button
              className="btn btn-download-x5"
              onClick={handleDownloadX5}
              disabled={isDownloadingX5 || isDownloadingAll || isTranscribing || isDownloading || isRunningAI || selectedVideoUrls.length === 0}
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

      {/* ─── Run AI Status ─── */}
      {isRunningAI && runAIStatus && (
        <div className="loading">
          <div className="spinner" />
          {runAIStatus}
        </div>
      )}

      {!isRunningAI && runAIStatus && (
        <div className="transcript-summary">
          {runAIStatus}
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
