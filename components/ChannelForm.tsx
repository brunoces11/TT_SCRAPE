"use client";

import { useState } from "react";

type ChannelFormProps = {
  onSubmit: (channelUrl: string, maxVideos: number) => void;
  isLoading: boolean;
};

export default function ChannelForm({ onSubmit, isLoading }: ChannelFormProps) {
  const [url, setUrl] = useState("");
  const [maxVideos, setMaxVideos] = useState(30);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url.trim(), maxVideos);
  };

  return (
    <form onSubmit={handleSubmit} className="channel-form">
      <div className="form-row">
        <div className="form-group form-group-url">
          <label htmlFor="channel-url">URL do Canal TikTok</label>
          <input
            id="channel-url"
            type="text"
            placeholder="https://www.tiktok.com/@usuario"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
        <div className="form-group form-group-max">
          <label htmlFor="max-videos">Máx. vídeos</label>
          <input
            id="max-videos"
            type="number"
            min={1}
            max={1000}
            value={maxVideos}
            onChange={(e) => setMaxVideos(Number(e.target.value) || 30)}
            disabled={isLoading}
          />
        </div>
        <div className="form-group form-group-btn">
          <button type="submit" disabled={isLoading || !url.trim()} className="btn btn-primary">
            {isLoading ? "Buscando..." : "Buscar Vídeos"}
          </button>
        </div>
      </div>
    </form>
  );
}
