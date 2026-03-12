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

    try {
      const res = await fetch("/api/transcribe-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrls: selectedVideoUrls, language: transcriptLanguage }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao buscar transcrições.");
        return;
      }

      const normalized = normalizeTranscripts(data.rawItems || [], channelRows);
      setTranscriptRows(normalized);
    } catch {
      setError("Erro de rede ao conectar com o servidor.");
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
    const rows = channelRows.map((r) => ({
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

      {/* ─── Channel Results Table ─── */}
      <VideoResultsTable
        rows={channelRows}
        selectedVideoUrls={selectedVideoUrls}
        onSelectionChange={setSelectedVideoUrls}
      />

      {/* ─── Channel CSV + Transcript Button ─── */}
      {channelRows.length > 0 && (
        <div className="action-bar">
          <CsvDownloadButton label="Download CSV" onClick={handleDownloadChannelCsv} />

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
              {isTranscribing ? "Baixando..." : "📝 Baixar transcrição dos vídeos"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Transcribing Loading ─── */}
      {isTranscribing && (
        <div className="loading">
          <div className="spinner" />
          Baixando transcrições... isso pode levar alguns minutos
        </div>
      )}

      {/* ─── Transcript Results Table ─── */}
      <TranscriptResultsTable rows={transcriptRows} />

      {/* ─── Transcript CSV ─── */}
      {transcriptRows.length > 0 && (
        <div className="action-bar">
          <CsvDownloadButton label="Download CSV com transcrição" onClick={handleDownloadTranscriptCsv} />
        </div>
      )}
    </main>
  );
}
