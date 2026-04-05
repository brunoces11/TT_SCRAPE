# Implementation Plan: ElevenLabs TTS Integration

## Overview

Integrate ElevenLabs TTS into the TikTok Scraper pipeline. The implementation follows the existing multi-account pattern (mirroring Apify), adds backend API routes for accounts/voices/credits/generate-tts, modifies the enrich-metadata response, updates the frontend flows (Run AI + Download All) to call TTS after enrichment, and adds new header UI controls (Voice ID dropdown, TTS API dropdown, ElevenLabs credits badge) in the specified order.

## Tasks

- [x] 1. Create ElevenLabs server library
  - [x] 1.1 Create `lib/elevenlabs-accounts.ts` with `ElevenLabsAccount` and `ElevenLabsVoice` interfaces, `getElevenLabsAccounts()`, `getTokenForElevenLabsAccount(accountId?)`, and `getElevenLabsVoices()` functions
    - Mirror the pattern in `lib/apify-accounts.ts`
    - Parse `ELEVENLABS_ACCOUNTS` env var (JSON array of `{id, label, token, default}`)
    - Parse `ELEVENLABS_VOICES` env var (JSON array of `{id, name, default}`)
    - Return `[]` on missing or invalid JSON (no throw)
    - Token resolution: specific accountId → default account → first account → `""`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.2 Write property test for env var parsing round trip
    - **Property 1: Env var parsing round trip**
    - **Validates: Requirements 1.1, 1.3**

  - [ ]* 1.3 Write property test for token resolution fallback chain
    - **Property 2: Token resolution fallback chain**
    - **Validates: Requirements 1.2**

- [x] 2. Create ElevenLabs API routes
  - [x] 2.1 Create `app/api/elevenlabs-accounts/route.ts` (GET)
    - Return `{ accounts: [{id, label, default}] }` — exclude `token` field
    - Use `getElevenLabsAccounts()` from the library
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Create `app/api/elevenlabs-voices/route.ts` (GET)
    - Return `{ voices: [{id, name, default}] }` from `getElevenLabsVoices()`
    - _Requirements: 3.1_

  - [x] 2.3 Create `app/api/elevenlabs-credits/route.ts` (GET)
    - Accept optional `accountId` query param
    - Call `GET https://api.elevenlabs.io/v1/user/subscription` with `xi-api-key` header
    - Return `{ characterCount, characterLimit, characterRemaining }`
    - Return `{ error }` with status 500 on failure
    - _Requirements: 4.1, 4.2_

  - [x] 2.4 Create `app/api/generate-tts/route.ts` (POST)
    - Accept `{ text, title, accountId?, voiceId }` body
    - Set `maxDuration = 120`
    - Call `POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}` with `xi-api-key` header and `{ text, model_id: "eleven_multilingual_v2" }` body
    - Replicate `sanitizeFilename()` locally (same logic as enrich-metadata)
    - Save audio as `{sanitizeFilename(title)}.mp3` in `downloads/`
    - Create `downloads/` if it doesn't exist
    - Return `{ status: "ok", filename }` on success, `{ error }` with 500 on failure
    - Each TTS call isolated with its own try/catch
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 2.5 Write property test for accounts endpoint excludes tokens
    - **Property 3: Accounts endpoint excludes tokens**
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 2.6 Write property test for credits endpoint field mapping
    - **Property 4: Credits endpoint maps subscription fields**
    - **Validates: Requirements 4.1**

  - [ ]* 2.7 Write property test for TTS filename consistency
    - **Property 5: TTS filename consistency**
    - **Validates: Requirements 5.2, 13.3**

- [x] 3. Checkpoint — Verify backend routes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Modify enrich-metadata to return llmVideos
  - [x] 4.1 Update `app/api/enrich-metadata/route.ts` to include `llmVideos: llmResult.videos` in the successful JSON response
    - Add `llmVideos` alongside existing `savedFiles`, `errors`, `debugLogs`, `downloadDir`
    - No changes to existing fields
    - _Requirements: 6.1, 13.2_

  - [ ]* 4.2 Write property test for enrich response preserving existing fields
    - **Property 7: Enrich response preserves existing fields and adds llmVideos**
    - **Validates: Requirements 6.1, 13.2**

- [x] 5. Add ElevenLabs header UI controls to frontend
  - [x] 5.1 Add new state variables and useEffect fetches in `app/page.tsx`
    - Add state: `elevenlabsAccounts`, `selectedElevenLabsAccountId`, `elevenlabsVoices`, `selectedVoiceId`, `elevenlabsCredits`
    - Add `fetchElevenLabsCredits(accountId?)` callback
    - On mount: fetch `/api/elevenlabs-accounts` and `/api/elevenlabs-voices`, set defaults from `default: true` items
    - Fetch credits on mount and when selected ElevenLabs account changes
    - _Requirements: 9.1, 9.2, 10.1, 10.4, 11.1, 11.2_

  - [x] 5.2 Reorder header controls in JSX
    - Render in order: (1) Settings icon, (2) Voice ID dropdown, (3) TTS API dropdown, (4) ElevenLabs credits badge, (5) Transcription API dropdown, (6) Apify credits badge
    - Voice ID dropdown: populated from voices API, pre-select default
    - TTS API dropdown: populated from accounts API, show even with 1 account (`elevenlabsAccounts.length >= 1`)
    - ElevenLabs credits badge: show `characterRemaining` formatted
    - Preserve existing Apify dropdown visibility condition (`apifyAccounts.length > 1`) — DO NOT change
    - _Requirements: 9.3, 10.2, 10.3, 11.3, 12.1, 12.2_

- [x] 6. Integrate TTS into Run AI flow
  - [x] 6.1 Modify `handleRunAI` in `app/page.tsx`
    - After successful enrich call, read `data.llmVideos`
    - If enrich HTTP fails → stop entirely (existing behavior, already implemented)
    - Loop over `llmVideos` sequentially with `for` loop
    - Skip items where `transcription.startsWith("ERRO:")` — add log entry and continue
    - For each valid item, call `POST /api/generate-tts` with `{ text: item.transcription, title: item.title, accountId: selectedElevenLabsAccountId, voiceId: selectedVoiceId }`
    - Update status: `"Generating TTS {i} of {total}..."`
    - Each TTS call in its own try/catch — log errors and continue
    - Update final status message to include TTS results
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 6.2 Write property test for TTS iteration skipping ERRO-prefixed transcriptions
    - **Property 6: TTS iteration skips ERRO-prefixed transcriptions**
    - **Validates: Requirements 7.3, 8.3**

- [x] 7. Integrate TTS into Download All flow
  - [x] 7.1 Modify `handleDownloadAll` in `app/page.tsx`
    - After enrich call, if `!enrichRes.ok` → add `return` + `setIsDownloadingAll(false)` to stop entire flow (fail-fast)
    - Read `enrichData.llmVideos`, loop sequentially with `for` loop
    - Skip items where `transcription.startsWith("ERRO:")` — add log entry and continue
    - For each valid item, call `POST /api/generate-tts` with `{ text: item.transcription, title: item.title, accountId: selectedElevenLabsAccountId, voiceId: selectedVoiceId }`
    - Update status: `"Generating TTS {i} of {total}..."`
    - Each TTS call in its own try/catch — log errors and continue
    - Then proceed to video downloads (existing Step 3)
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 8. Checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify existing buttons (Download Transcript, Download selected videos, Download all x5, Delete selected) still work unchanged
  - _Requirements: 13.1, 13.2, 13.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The project uses TypeScript with Next.js App Router
