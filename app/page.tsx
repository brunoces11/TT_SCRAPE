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

  // ─── Function 1: Fetch Channel ───
  const handleFetchChannel = async (params: SearchParams) => {
    setError(null);
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
        setError(data.error || "Erro ao buscar dados.");
        return;
      }

      setChannelRows(data.rows || []);
      setSelectedVideoUrls((data.rows || []).map((r: ChannelVideoRow) => r.videoUrl));
    } catch {
      setError("Erro de rede ao conectar com o servidor.");
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
      setError("Selecione pelo menos um vídeo.");
      return;
    }

    setError(null);
    setIsTranscribing(true);
    setTranscriptRows([]);
    setDetailLogs([]);
    setTranscriptStatus(`Aguardando transcrição de ${selectedVideoUrls.length} vídeo(s)... isso pode levar alguns minutos`);

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
        setError(data.error || "Erro ao buscar transcrições.");
        if (data.debugLogs) setDetailLogs(data.debugLogs);
        setTranscriptStatus(null);
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

      const ok = normalized.filter((r) => r.transcriptStatus === "ok").length;
      const failed = normalized.filter((r) => r.transcriptStatus === "failed").length;
      const saved = data.savedFiles?.length || 0;
      let statusMsg = `Concluído: ${ok} transcrição(ões) com sucesso, ${failed} falha(s) — ${saved} arquivo(s) .txt salvo(s) em /downloads`;
      if (saved === 0 && failed > 0) {
        statusMsg += ` ⚠️ Nenhum vídeo selecionado possui transcrição disponível (vídeos sem fala/legenda)`;
      }
      setTranscriptStatus(statusMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(`Erro de rede: ${msg}`);
      setTranscriptStatus(null);
    } finally {
      setIsTranscribing(false);
    }
  };

  // ─── Download Videos via yt-dlp ───
  const handleDownloadVideos = async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Selecione pelo menos um vídeo para baixar.");
      return;
    }

    setError(null);
    setIsDownloading(true);
    setDownloadStatus(`Baixando ${selectedVideoUrls.length} vídeo(s)... isso pode levar alguns minutos`);

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
        setError(data.error || "Erro ao baixar vídeos.");
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
      setError(`Erro de rede ao baixar vídeos: ${msg}`);
      setDownloadStatus(null);
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── Download All (transcripts + videos) — resiliente ───
  const handleDownloadAll = async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Selecione pelo menos um vídeo.");
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

  return (
    <main className="container">
      <h1>🎵 TikTok Scraper & Transcript Tool</h1>
      <p className="subtitle">Ferramenta local de pesquisa — extraia dados e transcrições de canais do TikTok</p>

      {/* ─── Channel Form ─── */}
      <ChannelForm onSubmit={handleFetchChannel} isLoading={isFetchingChannel} />

      {/* ─── Loading / Error ─── */}
      {isFetchingChannel && (
        <div className="loading">
          <div className="spinner" />
          Buscando dados do canal... isso pode levar até 2 minutos
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
              disabled={isTranscribing || selectedVideoUrls.length === 0}
            >
              {isTranscribing ? "Baixando..." : "📝 Baixar Transcrição"}
            </button>

            <button
              className="btn btn-download"
              onClick={handleDownloadVideos}
              disabled={isDownloading || selectedVideoUrls.length === 0}
            >
              {isDownloading ? "Baixando..." : "⬇️ Baixar vídeos selecionados"}
            </button>

            <button
              className="btn btn-download-all"
              onClick={handleDownloadAll}
              disabled={isDownloadingAll || isTranscribing || isDownloading || selectedVideoUrls.length === 0}
            >
              {isDownloadingAll ? "Baixando tudo..." : "📦 Baixar tudo"}
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
            <span>📋 Log de execução ({detailLogs.length} eventos)</span>
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
      <SavedSearches onLoad={(rows) => {
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
      }} />
    </main>
  );
}
