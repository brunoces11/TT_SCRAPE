"use client";

import { useState, useEffect } from "react";

type SavedSearch = { filename: string; label: string };

type SavedSearchesProps = {
  onLoad: (rows: Record<string, unknown>[], filename: string) => void;
};

export default function SavedSearches({ onLoad }: SavedSearchesProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/saved-searches")
      .then((r) => r.json())
      .then((d) => setSearches(d.searches || []))
      .catch(() => {});
  }, []);

  const handleLoad = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/saved-searches?file=${encodeURIComponent(selected)}`);
      const data = await res.json();
      onLoad(data.rows || [], selected);
    } catch {
      onLoad([], "");
    } finally {
      setLoading(false);
    }
  };

  if (searches.length === 0) return null;

  return (
    <div className="saved-searches">
      <h2>📂 Saved Searches</h2>
      <div className="saved-search-row">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="language-select"
          style={{ flex: 1 }}
        >
          <option value="">Select a previous search...</option>
          {searches.map((s) => (
            <option key={s.filename} value={s.filename}>
              {s.label} ({s.filename})
            </option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          onClick={handleLoad}
          disabled={!selected || loading}
        >
          {loading ? "Loading..." : "📂 Load search"}
        </button>
      </div>
    </div>
  );
}
