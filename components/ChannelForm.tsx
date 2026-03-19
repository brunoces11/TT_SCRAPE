"use client";

import { useState } from "react";

const COUNTRIES = [
  { code: "BR", flag: "🇧🇷", name: "Brasil" },
  { code: "US", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "ID", flag: "🇮🇩", name: "Indonésia" },
  { code: "MX", flag: "🇲🇽", name: "México" },
  { code: "PH", flag: "🇵🇭", name: "Filipinas" },
  { code: "VN", flag: "🇻🇳", name: "Vietnã" },
  { code: "TH", flag: "🇹🇭", name: "Tailândia" },
  { code: "GB", flag: "🇬🇧", name: "Reino Unido" },
  { code: "TR", flag: "🇹🇷", name: "Turquia" },
  { code: "SA", flag: "🇸🇦", name: "Arábia Saudita" },
  { code: "EG", flag: "🇪🇬", name: "Egito" },
  { code: "DE", flag: "🇩🇪", name: "Alemanha" },
  { code: "FR", flag: "🇫🇷", name: "França" },
  { code: "JP", flag: "🇯🇵", name: "Japão" },
  { code: "KR", flag: "🇰🇷", name: "Coreia do Sul" },
  { code: "IN", flag: "🇮🇳", name: "Índia" },
  { code: "RU", flag: "🇷🇺", name: "Rússia" },
  { code: "IT", flag: "🇮🇹", name: "Itália" },
  { code: "ES", flag: "🇪🇸", name: "Espanha" },
  { code: "AR", flag: "🇦🇷", name: "Argentina" },
  { code: "CO", flag: "🇨🇴", name: "Colômbia" },
  { code: "PL", flag: "🇵🇱", name: "Polônia" },
  { code: "MY", flag: "🇲🇾", name: "Malásia" },
  { code: "AU", flag: "🇦🇺", name: "Austrália" },
  { code: "CA", flag: "🇨🇦", name: "Canadá" },
  { code: "NL", flag: "🇳🇱", name: "Países Baixos" },
  { code: "PK", flag: "🇵🇰", name: "Paquistão" },
  { code: "BD", flag: "🇧🇩", name: "Bangladesh" },
  { code: "NG", flag: "🇳🇬", name: "Nigéria" },
  { code: "UA", flag: "🇺🇦", name: "Ucrânia" },
  { code: "RO", flag: "🇷🇴", name: "Romênia" },
  { code: "IQ", flag: "🇮🇶", name: "Iraque" },
  { code: "MA", flag: "🇲🇦", name: "Marrocos" },
  { code: "PE", flag: "🇵🇪", name: "Peru" },
  { code: "CL", flag: "🇨🇱", name: "Chile" },
  { code: "TW", flag: "🇹🇼", name: "Taiwan" },
  { code: "IL", flag: "🇮🇱", name: "Israel" },
  { code: "SE", flag: "🇸🇪", name: "Suécia" },
  { code: "BE", flag: "🇧🇪", name: "Bélgica" },
  { code: "CZ", flag: "🇨🇿", name: "Tchéquia" },
  { code: "PT", flag: "🇵🇹", name: "Portugal" },
  { code: "AT", flag: "🇦🇹", name: "Áustria" },
  { code: "CH", flag: "🇨🇭", name: "Suíça" },
  { code: "GR", flag: "🇬🇷", name: "Grécia" },
  { code: "HU", flag: "🇭🇺", name: "Hungria" },
  { code: "DZ", flag: "🇩🇿", name: "Argélia" },
  { code: "KZ", flag: "🇰🇿", name: "Cazaquistão" },
  { code: "AE", flag: "🇦🇪", name: "Emirados Árabes" },
  { code: "ZA", flag: "🇿🇦", name: "África do Sul" },
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
          <label htmlFor="country">Região</label>
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
          <label htmlFor="channel-url">URL do Canal</label>
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
          <label htmlFor="keyword">Palavra-chave</label>
          <input
            id="keyword"
            type="text"
            placeholder="ex: inteligência artificial"
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
            placeholder="ex: ia, tecnologia"
            value={hashtag}
            onChange={(e) => setHashtag(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="form-group form-group-max">
          <label htmlFor="max-videos">Máx.</label>
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
            {isLoading ? "Buscando..." : "🔍 Buscar"}
          </button>
        </div>
      </div>
      {selectedCountry && (
        <div className="form-hint">
          {selectedCountry.flag} Buscando conteúdo da região: {selectedCountry.name}
        </div>
      )}
    </form>
  );
}
