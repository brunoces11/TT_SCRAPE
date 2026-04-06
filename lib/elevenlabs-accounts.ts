// TTS Accounts & Voices library (currently Mistral Voxtral TTS)
// Reads MISTRAL_TTS_ACCOUNTS and MISTRAL_TTS_VOICES env vars
// Backups: lib/elevenlabs-accounts.ts.bak (ElevenLabs), lib/google_tts_accounts.ts.bak (Google)

export interface ElevenLabsAccount {
  id: string;
  label: string;
  token: string;
  default: boolean;
}

export interface ElevenLabsVoice {
  id: string;
  name: string;
  default: boolean;
}

export function getElevenLabsAccounts(): ElevenLabsAccount[] {
  const raw = process.env.MISTRAL_TTS_ACCOUNTS;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ElevenLabsAccount[];
  } catch {
    return [];
  }
}

export function getTokenForElevenLabsAccount(accountId?: string): string {
  const accounts = getElevenLabsAccounts();
  if (accountId) {
    const found = accounts.find((a) => a.id === accountId);
    if (found) return found.token;
  }
  const defaultAcc = accounts.find((a) => a.default);
  if (defaultAcc) return defaultAcc.token;
  return accounts[0]?.token || "";
}

export function getElevenLabsVoices(): ElevenLabsVoice[] {
  const raw = process.env.MISTRAL_TTS_VOICES;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ElevenLabsVoice[];
  } catch {
    return [];
  }
}
