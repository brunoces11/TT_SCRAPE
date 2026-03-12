"use client";

type CsvDownloadButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export default function CsvDownloadButton({ label, onClick, disabled }: CsvDownloadButtonProps) {
  return (
    <button
      className="btn btn-csv"
      onClick={onClick}
      disabled={disabled}
    >
      📥 {label}
    </button>
  );
}
