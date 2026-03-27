"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { ChannelVideoRow } from "@/types";

type SortKey = keyof ChannelVideoRow | null;
type SortDir = "asc" | "desc";

type VideoResultsTableProps = {
  rows: ChannelVideoRow[];
  selectedVideoUrls: string[];
  onSelectionChange: (selected: string[]) => void;
};

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export default function VideoResultsTable({
  rows,
  selectedVideoUrls,
  onSelectionChange,
}: VideoResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const tableRef = useRef<HTMLTableElement>(null);
  const resizingRef = useRef<{ col: number; startX: number; startW: number } | null>(null);

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

  const handleMouseDown = useCallback((e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const table = tableRef.current;
    if (!table) return;
    const th = table.querySelectorAll("thead th")[colIndex] as HTMLElement;
    resizingRef.current = { col: colIndex, startX: e.clientX, startW: th.offsetWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = ev.clientX - resizingRef.current.startX;
      const newW = Math.max(40, resizingRef.current.startW + diff);
      th.style.width = `${newW}px`;
      th.style.minWidth = `${newW}px`;
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  if (rows.length === 0) return null;

  return (
    <div className="table-container">
      <h2>Results ({rows.length} videos)</h2>
      <div className="table-scroll">
        <table ref={tableRef} style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th className="col-checkbox" style={{ width: 40 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} title="Select all" />
              </th>
              <th className="sortable resizable" onClick={() => handleSort("publishDate")} style={{ width: 80 }}>
                Data{sortIndicator("publishDate")}
                <span className="resize-handle" onMouseDown={(e) => handleMouseDown(e, 1)} />
              </th>
              <th className="col-number sortable resizable" onClick={() => handleSort("views")} style={{ width: 90 }}>
                Views{sortIndicator("views")}
                <span className="resize-handle" onMouseDown={(e) => handleMouseDown(e, 2)} />
              </th>
              <th className="col-number sortable resizable" onClick={() => handleSort("likes")} style={{ width: 80 }}>
                Likes{sortIndicator("likes")}
                <span className="resize-handle" onMouseDown={(e) => handleMouseDown(e, 3)} />
              </th>
              <th className="col-number sortable resizable" onClick={() => handleSort("comments")} style={{ width: 80 }}>
                💬{sortIndicator("comments")}
                <span className="resize-handle" onMouseDown={(e) => handleMouseDown(e, 4)} />
              </th>
              <th className="sortable resizable" onClick={() => handleSort("title")} style={{ width: 200 }}>
                Title{sortIndicator("title")}
                <span className="resize-handle" onMouseDown={(e) => handleMouseDown(e, 5)} />
              </th>
              <th className="sortable resizable" onClick={() => handleSort("description")} style={{ width: 250 }}>
                Description{sortIndicator("description")}
                <span className="resize-handle" onMouseDown={(e) => handleMouseDown(e, 6)} />
              </th>
              <th className="sortable resizable" onClick={() => handleSort("hashtags")} style={{ width: 150 }}>
                #{sortIndicator("hashtags")}
                <span className="resize-handle" onMouseDown={(e) => handleMouseDown(e, 7)} />
              </th>
              <th style={{ width: 50 }}>URL</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => (
              <tr key={row.videoId || idx}>
                <td className="col-checkbox">
                  <input type="checkbox" checked={selectedVideoUrls.includes(row.videoUrl)} onChange={() => toggleRow(row.videoUrl)} />
                </td>
                <td className="col-date">{formatDate(row.publishDate)}</td>
                <td className="col-number">{row.views.toLocaleString("en-US")}</td>
                <td className="col-number">{row.likes.toLocaleString("en-US")}</td>
                <td className="col-number">{row.comments?.toLocaleString("en-US") ?? "—"}</td>
                <td className="col-title" title={row.title}>{row.title}</td>
                <td className="col-desc" title={row.description}>
                  {row.description.substring(0, 100)}{row.description.length > 100 ? "..." : ""}
                </td>
                <td className="col-hashtags">{row.hashtags.join(", ")}</td>
                <td className="col-url">
                  <a href={row.videoUrl} target="_blank" rel="noopener noreferrer">Link</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
