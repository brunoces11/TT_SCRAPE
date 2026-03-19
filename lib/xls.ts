import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";

const XLS_DIR = path.join(process.cwd(), "XLS");

function sanitizeName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 80);
}

export function buildSearchLabel(params: {
  channelUrl?: string;
  keyword?: string;
  hashtag?: string;
}): string {
  const parts: string[] = [];
  if (params.channelUrl) {
    const match = params.channelUrl.match(/@([\w.]+)/);
    parts.push(match ? match[1] : params.channelUrl);
  }
  if (params.keyword) parts.push(params.keyword);
  if (params.hashtag) parts.push(params.hashtag);
  return parts.join("_") || "busca";
}

export interface SearchRow {
  video_title: string;
  views: number;
  description: string;
  likes: number;
  hashtags: string;
  video_url: string;
  comments: string | number;
  publish_date: string;
}

export function saveSearchToXls(label: string, rows: SearchRow[]): string {
  if (!fs.existsSync(XLS_DIR)) {
    fs.mkdirSync(XLS_DIR, { recursive: true });
  }

  const safeName = sanitizeName(label);
  const filename = `SCRAPE_${safeName}.xlsx`;
  const filepath = path.join(XLS_DIR, filename);

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Resultados");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(filepath, buf);

  return filename;
}

export function listSavedSearches(): { filename: string; label: string }[] {
  if (!fs.existsSync(XLS_DIR)) return [];
  const files = fs.readdirSync(XLS_DIR)
    .filter((f) => f.startsWith("SCRAPE_") && f.endsWith(".xlsx"))
    .sort((a, b) => {
      const statA = fs.statSync(path.join(XLS_DIR, a));
      const statB = fs.statSync(path.join(XLS_DIR, b));
      return statB.mtimeMs - statA.mtimeMs; // newest first
    });

  return files.map((f) => ({
    filename: f,
    label: f.replace("SCRAPE_", "").replace(".xlsx", "").replace(/_/g, " "),
  }));
}

export function loadSearchFromXls(filename: string): SearchRow[] {
  const filepath = path.join(XLS_DIR, filename);
  if (!fs.existsSync(filepath)) return [];
  const buf = fs.readFileSync(filepath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<SearchRow>(ws);
}

export function deleteRowsFromXls(filename: string, videoUrls: string[]): number {
  const filepath = path.join(XLS_DIR, filename);
  if (!fs.existsSync(filepath)) return 0;

  const buf = fs.readFileSync(filepath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<SearchRow>(ws);

  const urlSet = new Set(videoUrls);
  const filtered = rows.filter((r) => !urlSet.has(r.video_url));
  const deleted = rows.length - filtered.length;

  if (deleted > 0) {
    const newWs = XLSX.utils.json_to_sheet(filtered);
    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, newWs, "Resultados");
    const newBuf = XLSX.write(newWb, { type: "buffer", bookType: "xlsx" });
    fs.writeFileSync(filepath, newBuf);
  }

  return deleted;
}

const BLACKLIST_PATH = path.join(XLS_DIR, "blacklist.json");

export function getBlacklist(): Set<string> {
  if (!fs.existsSync(BLACKLIST_PATH)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(BLACKLIST_PATH, "utf-8"));
    return new Set(Array.isArray(data) ? data : []);
  } catch {
    return new Set();
  }
}

export function addToBlacklist(videoUrls: string[]): void {
  if (!fs.existsSync(XLS_DIR)) {
    fs.mkdirSync(XLS_DIR, { recursive: true });
  }
  const current = getBlacklist();
  for (const url of videoUrls) {
    current.add(url);
  }
  fs.writeFileSync(BLACKLIST_PATH, JSON.stringify([...current], null, 2), "utf-8");
}
