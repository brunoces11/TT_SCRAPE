"use client";

import { useState } from "react";
import ChannelForm from "@/components/ChannelForm";
import VideoResultsTable from "@/components/VideoResultsTable";
import TranscriptResultsTable from "@/components/TranscriptResultsTable";
import CsvDownloadButton from "@/components/CsvDownloadButton";
import { ChannelVideoRow, TranscriptRow } from "@/types";
import { normalizeTranscripts } from "@/lib/normalize";
import { generateCsvString, downloadCsv } from "@/lib/csv";

export default function Home() {
  const [channelRows, setChannelRows] = useState<ChannelVideoRow[]>([]);
  const [selectedVideoUrls, setSelectedVideoUrls] = useState<string[]>([]);
  const [transcriptLanguage, setTranscriptLanguage] = useState("pt");
  const [transcriptRows, setTranscriptRows] = useState<TranscriptRow[]>([]);
  const [isFetchingChannel, setIsFetchingChannel] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // ─── Function 1: Fetch Channel ───
  const handleFetchChannel = async (channelUrl: string, maxVideos: number) => {
    setError(null);
    setIsFetchingChannel(true);
    setChannelRows([]);
    setSelectedVideoUrls([]);
    setTranscriptRows([]);

    try {
      const res = await fetch("/api/fetch-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelUrl, resultsPerPage: maxVideos }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao buscar dados do canal.");
        return;
      }

      setChannelRows(data.rows || []);
    } catch {
      setError("Erro de rede ao conectar com o servidor.");
    } finally {
      setIsFetchingChannel(false);
    }
  };

  // ─── Function 2: Fetch Transcripts ───
  const handleTranscribe = async () => {
    if (selectedVideoUrls.length === 0) {
      setError("Selecione pelo menos um vídeo.");
      return;
    }

    setError(null);
    setIsTranscribing(true);
    setTranscriptRows([]);
    setTranscriptStatus(`Enviando ${selectedVideoUrls.length} vídeo(s) para transcrição...`);

    try {
      setTranscriptStatus(`Aguardando transcrição de ${selectedVideoUrls.length} vídeo(s)... isso pode levar alguns minutos`);

      const res = await fetch("/api/transcribe-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrls: selectedVideoUrls, language: transcriptLanguage }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao buscar transcrições.");
        setTranscriptStatus(null);
        return;
      }

      const normalized = normalizeTranscripts(data.rawItems || [], channelRows);
      setTranscriptRows(normalized);

      const ok = normalized.filter((r) => r.transcriptStatus === "ok").length;
      const failed = normalized.filter((r) => r.transcriptStatus === "failed").length;
      setTranscriptStatus(`Concluído: ${ok} transcrição(ões) com sucesso, ${failed} falha(s) — de ${normalized.length} vídeo(s)`);
    } catch {
      setError("Erro de rede ao conectar com o servidor. A transcrição pode demorar mais que o esperado — tente novamente.");
      setTranscriptStatus(null);
    } finally {
      setIsTranscribing(false);
    }
  };

  // ─── CSV Downloads ───
  const handleDownloadChannelCsv = () => {
    const columns = [
      "video_title", "views", "description", "likes",
      "hashtags", "video_id", "video_url", "comments", "publish_date",
    ];
    const source = selectedVideoUrls.length > 0
      ? channelRows.filter((r) => selectedVideoUrls.includes(r.videoUrl))
      : channelRows;
    const rows = source.map((r) => ({
      video_title: r.title,
      views: r.views,
      description: r.description,
      likes: r.likes,
      hashtags: r.hashtags.join(", "),
      video_id: r.videoId,
      video_url: r.videoUrl,
      comments: r.comments ?? "",
      publish_date: r.publishDate ?? "",
    }));
    const csv = generateCsvString(columns, rows);
    downloadCsv(csv, "channel_videos.csv");
  };

  const handleDownloadTranscriptCsv = () => {
    const columns = [
      "video_title", "views", "description", "likes",
      "hashtags", "video_id", "video_url", "transcript",
    ];
    const rows = transcriptRows.map((r) => ({
      video_title: r.title,
      views: r.views,
      description: r.description,
      likes: r.likes,
      hashtags: r.hashtags.join(", "),
      video_id: r.videoId,
      video_url: r.videoUrl,
      transcript: r.transcript,
    }));
    const csv = generateCsvString(columns, rows);
    downloadCsv(csv, "transcripts.csv");
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
        body: JSON.stringify({ videoUrls: selectedVideoUrls }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao baixar vídeos.");
        setDownloadStatus(null);
        return;
      }

      setDownloadStatus(data.message);
    } catch {
      setError("Erro de rede ao baixar vídeos.");
      setDownloadStatus(null);
    } finally {
      setIsDownloading(false);
    }
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
          <CsvDownloadButton label="Download | Lista de vídeos | CSV" onClick={handleDownloadChannelCsv} />

          <div className="transcript-actions">
            <select
              value={transcriptLanguage}
              onChange={(e) => setTranscriptLanguage(e.target.value)}
              className="language-select"
              disabled={isTranscribing}
            >
              <option value="pt">Português</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>

            <button
              className="btn btn-transcript"
              onClick={handleTranscribe}
              disabled={isTranscribing || selectedVideoUrls.length === 0}
            >
              {isTranscribing ? "Baixando..." : "📝 Capturar transcrição dos vídeos"}
            </button>

            <button
              className="btn btn-download"
              onClick={handleDownloadVideos}
              disabled={isDownloading || selectedVideoUrls.length === 0}
            >
              {isDownloading ? "Baixando..." : "⬇️ Baixar vídeos selecionados"}
            </button>

            {transcriptRows.length > 0 && (
              <CsvDownloadButton label="Download | Transcrição dos vídeos | CSV" onClick={handleDownloadTranscriptCsv} />
            )}
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
      {!isTranscribing && transcriptStatus && transcriptRows.length > 0 && (
        <div className="transcript-summary">
          {transcriptStatus}
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
    </main>
  );
}
