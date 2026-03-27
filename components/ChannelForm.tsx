"use client";

import { useState } from "react";

const COUNTRIES = [
  { code: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "US", flag: "🇺🇸", name: "United States" },
  { code: "ID", flag: "🇮🇩", name: "Indonesia" },
  { code: "MX", flag: "🇲🇽", name: "Mexico" },
  { code: "PH", flag: "🇵🇭", name: "Philippines" },
  { code: "VN", flag: "🇻🇳", name: "Vietnam" },
  { code: "TH", flag: "🇹🇭", name: "Thailand" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom" },
  { code: "TR", flag: "🇹🇷", name: "Turkey" },
  { code: "SA", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "EG", flag: "🇪🇬", name: "Egypt" },
  { code: "DE", flag: "🇩🇪", name: "Germany" },
  { code: "FR", flag: "🇫🇷", name: "France" },
  { code: "JP", flag: "🇯🇵", name: "Japan" },
  { code: "KR", flag: "🇰🇷", name: "South Korea" },
  { code: "IN", flag: "🇮🇳", name: "India" },
  { code: "RU", flag: "🇷🇺", name: "Russia" },
  { code: "IT", flag: "🇮🇹", name: "Italy" },
  { code: "ES", flag: "🇪🇸", name: "Spain" },
  { code: "AR", flag: "🇦🇷", name: "Argentina" },
  { code: "CO", flag: "🇨🇴", name: "Colombia" },
  { code: "PL", flag: "🇵🇱", name: "Poland" },
  { code: "MY", flag: "🇲🇾", name: "Malaysia" },
  { code: "AU", flag: "🇦🇺", name: "Australia" },
  { code: "CA", flag: "🇨🇦", name: "Canada" },
  { code: "NL", flag: "🇳🇱", name: "Netherlands" },
  { code: "PK", flag: "🇵🇰", name: "Pakistan" },
  { code: "BD", flag: "🇧🇩", name: "Bangladesh" },
  { code: "NG", flag: "🇳🇬", name: "Nigeria" },
  { code: "UA", flag: "🇺🇦", name: "Ukraine" },
  { code: "RO", flag: "🇷🇴", name: "Romania" },
  { code: "IQ", flag: "🇮🇶", name: "Iraq" },
  { code: "MA", flag: "🇲🇦", name: "Morocco" },
  { code: "PE", flag: "🇵🇪", name: "Peru" },
  { code: "CL", flag: "🇨🇱", name: "Chile" },
  { code: "TW", flag: "🇹🇼", name: "Taiwan" },
  { code: "IL", flag: "🇮🇱", name: "Israel" },
  { code: "SE", flag: "🇸🇪", name: "Sweden" },
  { code: "BE", flag: "🇧🇪", name: "Belgium" },
  { code: "CZ", flag: "🇨🇿", name: "Czechia" },
  { code: "PT", flag: "🇵🇹", name: "Portugal" },
  { code: "AT", flag: "🇦🇹", name: "Austria" },
  { code: "CH", flag: "🇨🇭", name: "Switzerland" },
  { code: "GR", flag: "🇬🇷", name: "Greece" },
  { code: "HU", flag: "🇭🇺", name: "Hungary" },
  { code: "DZ", flag: "🇩🇿", name: "Algeria" },
  { code: "KZ", flag: "🇰🇿", name: "Kazakhstan" },
  { code: "AE", flag: "🇦🇪", name: "United Arab Emirates" },
  { code: "ZA", flag: "🇿🇦", name: "South Africa" },
];

export type SearchParams = {
  channelUrl: string;
  keyword: string;
  hashtag: string;
  maxVideos: number;
  countryCode: string;
};

type ChannelFormProps = {
  onSubmit: (params: SearchParams) => void;
  isLoading: boolean;
};

export default function ChannelForm({ onSubmit, isLoading }: ChannelFormProps) {
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [hashtag, setHashtag] = useState("");
  const [maxVideos, setMaxVideos] = useState(50);
  const [countryCode, setCountryCode] = useState("BR");

  const hasAnyInput = url.trim() || keyword.trim() || hashtag.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAnyInput) return;
    onSubmit({
      channelUrl: url.trim(),
      keyword: keyword.trim(),
      hashtag: hashtag.trim(),
      maxVideos,
      countryCode,
    });
  };

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode);

  return (
    <form onSubmit={handleSubmit} className="channel-form">
      <div className="form-row">
        <div className="form-group form-group-country">
          <label htmlFor="country">Region</label>
          <select
            id="country"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            disabled={isLoading}
            className="country-select"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group form-group-url">
          <label htmlFor="channel-url">Channel URL</label>
          <input
            id="channel-url"
            type="text"
            placeholder="https://www.tiktok.com/@usuario"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="form-group form-group-keyword">
          <label htmlFor="keyword">Keyword</label>
          <input
            id="keyword"
            type="text"
            placeholder="e.g. artificial intelligence"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="form-group form-group-hashtag">
          <label htmlFor="hashtag">Hashtag</label>
          <input
            id="hashtag"
            type="text"
            placeholder="e.g. ai, technology"
            value={hashtag}
            onChange={(e) => setHashtag(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="form-group form-group-max">
          <label htmlFor="max-videos">Max</label>
          <input
            id="max-videos"
            type="number"
            min={1}
            max={1000}
            value={maxVideos}
            onChange={(e) => setMaxVideos(Number(e.target.value) || 50)}
            disabled={isLoading}
          />
        </div>
        <div className="form-group form-group-btn">
          <button type="submit" disabled={isLoading || !hasAnyInput} className="btn btn-primary">
            {isLoading ? "Searching..." : "🔍 Search"}
          </button>
        </div>
      </div>
      {selectedCountry && (
        <div className="form-hint">
          {selectedCountry.flag} Searching content from region: {selectedCountry.name}
        </div>
      )}
    </form>
  );
}
