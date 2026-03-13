"use client";

import { useState, useMemo } from "react";
import { TranscriptRow } from "@/types";

type SortKey = keyof TranscriptRow | null;
type SortDir = "asc" | "desc";

type TranscriptResultsTableProps = {
  rows: TranscriptRow[];
};

export default function TranscriptResultsTable({ rows }: TranscriptResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = Array.isArray(av) ? av.join(", ") : String(av);
      const bs = Array.isArray(bv) ? bv.join(", ") : String(bv);
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [rows, sortKey, sortDir]);

  if (rows.length === 0) return null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="table-container">
      <h2>Transcrições ({rows.length} vídeos)</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th className="sortable" onClick={() => handleSort("title")}>Título{sortIndicator("title")}</th>
              <th className="sortable" onClick={() => handleSort("videoId")}>Video ID{sortIndicator("videoId")}</th>
              <th className="col-number sortable" onClick={() => handleSort("views")}>Views{sortIndicator("views")}</th>
              <th className="col-number sortable" onClick={() => handleSort("likes")}>Likes{sortIndicator("likes")}</th>
              <th className="sortable" onClick={() => handleSort("hashtags")}>Hashtags{sortIndicator("hashtags")}</th>
              <th className="sortable" onClick={() => handleSort("description")}>Descrição{sortIndicator("description")}</th>
              <th className="sortable" onClick={() => handleSort("transcriptStatus")}>Transcrição{sortIndicator("transcriptStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => (
              <tr key={row.videoId || idx} className={row.transcriptStatus === "failed" ? "row-failed" : ""}>
                <td className="col-url">
                  <a href={row.videoUrl} target="_blank" rel="noopener noreferrer">Link</a>
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
