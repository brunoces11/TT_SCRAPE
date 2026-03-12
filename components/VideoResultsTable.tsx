"use client";

import { ChannelVideoRow } from "@/types";

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
  if (rows.length === 0) return null;

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
              <th>Título</th>
              <th className="col-number">Views</th>
              <th>Descrição</th>
              <th className="col-number">Likes</th>
              <th>Hashtags</th>
              <th>Video ID</th>
              <th>URL</th>
              <th className="col-number">Comentários</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
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
