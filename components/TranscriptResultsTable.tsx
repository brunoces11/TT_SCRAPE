"use client";

import { TranscriptRow } from "@/types";

type TranscriptResultsTableProps = {
  rows: TranscriptRow[];
};

export default function TranscriptResultsTable({ rows }: TranscriptResultsTableProps) {
  if (rows.length === 0) return null;

  return (
    <div className="table-container">
      <h2>Transcrições ({rows.length} vídeos)</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Título</th>
              <th>Video ID</th>
              <th className="col-number">Views</th>
              <th className="col-number">Likes</th>
              <th>Hashtags</th>
              <th>Descrição</th>
              <th>Transcrição</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.videoId || idx} className={row.transcriptStatus === "failed" ? "row-failed" : ""}>
                <td className="col-url">
                  <a href={row.videoUrl} target="_blank" rel="noopener noreferrer">
                    Link
                  </a>
                </td>
                <td className="col-title" title={row.title}>{row.title}</td>
                <td className="col-id">{row.videoId}</td>
                <td className="col-number">{row.views.toLocaleString("pt-BR")}</td>
                <td className="col-number">{row.likes.toLocaleString("pt-BR")}</td>
                <td className="col-hashtags">{row.hashtags.join(", ")}</td>
                <td className="col-desc" title={row.description}>
                  {row.description.substring(0, 100)}
                  {row.description.length > 100 ? "..." : ""}
                </td>
                <td className="col-transcript">
                  {row.transcriptStatus === "failed" ? (
                    <span className="badge-failed">FALHOU</span>
                  ) : (
                    <span title={row.transcript}>
                      {row.transcript.substring(0, 200)}
                      {row.transcript.length > 200 ? "..." : ""}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
