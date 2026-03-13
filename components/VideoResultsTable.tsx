"use client";

import { useState, useMemo } from "react";
import { ChannelVideoRow } from "@/types";

type SortKey = keyof ChannelVideoRow | null;
type SortDir = "asc" | "desc";

type VideoResultsTableProps = {
  rows: ChannelVideoRow[];
  selectedVideoUrls: string[];
  onSelectionChange: (selected: string[]) => void;
};

export default function VideoResultsTable({
  rows,
  selectedVideoUrls,
  onSelectionChange,
}: VideoResultsTableProps) {
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

  const allSelected = rows.length > 0 && rows.every((r) => selectedVideoUrls.includes(r.videoUrl));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(rows.map((r) => r.videoUrl));
    }
  };

  const toggleRow = (videoUrl: string) => {
    if (selectedVideoUrls.includes(videoUrl)) {
      onSelectionChange(selectedVideoUrls.filter((u) => u !== videoUrl));
    } else {
      onSelectionChange([...selectedVideoUrls, videoUrl]);
    }
  };

  return (
    <div className="table-container">
      <h2>Resultados do Canal ({rows.length} vídeos)</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="col-checkbox">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  title="Selecionar todos"
                />
              </th>
              <th className="sortable" onClick={() => handleSort("title")}>Título{sortIndicator("title")}</th>
              <th className="col-number sortable" onClick={() => handleSort("views")}>Views{sortIndicator("views")}</th>
              <th className="sortable" onClick={() => handleSort("description")}>Descrição{sortIndicator("description")}</th>
              <th className="col-number sortable" onClick={() => handleSort("likes")}>Likes{sortIndicator("likes")}</th>
              <th className="sortable" onClick={() => handleSort("hashtags")}>Hashtags{sortIndicator("hashtags")}</th>
              <th className="sortable" onClick={() => handleSort("videoId")}>Video ID{sortIndicator("videoId")}</th>
              <th>URL</th>
              <th className="col-number sortable" onClick={() => handleSort("comments")}>Comentários{sortIndicator("comments")}</th>
              <th className="sortable" onClick={() => handleSort("publishDate")}>Data{sortIndicator("publishDate")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => (
              <tr key={row.videoId || idx}>
                <td className="col-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedVideoUrls.includes(row.videoUrl)}
                    onChange={() => toggleRow(row.videoUrl)}
                  />
                </td>
                <td className="col-title" title={row.title}>{row.title}</td>
                <td className="col-number">{row.views.toLocaleString("pt-BR")}</td>
                <td className="col-desc" title={row.description}>
                  {row.description.substring(0, 100)}
                  {row.description.length > 100 ? "..." : ""}
                </td>
                <td className="col-number">{row.likes.toLocaleString("pt-BR")}</td>
                <td className="col-hashtags">{row.hashtags.join(", ")}</td>
                <td className="col-id">{row.videoId}</td>
                <td className="col-url">
                  <a href={row.videoUrl} target="_blank" rel="noopener noreferrer">
                    Link
                  </a>
                </td>
                <td className="col-number">{row.comments?.toLocaleString("pt-BR") ?? "—"}</td>
                <td className="col-date">{row.publishDate || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
