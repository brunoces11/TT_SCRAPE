# Requirements Document

## Introduction

Integrate ElevenLabs Text-to-Speech (TTS) API into the existing TikTok Scraper pipeline. After the OpenAI enrich step produces LLM_Transcription content for each selected video, the system automatically generates professional MP3 audio files via ElevenLabs TTS. The integration follows the same dynamic multi-account pattern already used for Apify, adds voice selection and ElevenLabs credits display to the header UI, and triggers TTS generation in both the "Run AI" and "Download All" flows.

## Glossary

- **TTS_Engine**: The backend module responsible for calling the ElevenLabs TTS API and saving the resulting MP3 file to disk.
- **Generate_TTS_Endpoint**: The Next.js API route at `/api/generate-tts` that receives text, title, accountId, and voiceId, calls ElevenLabs, and writes the MP3 to the downloads folder.
- **ElevenLabs_Accounts_Endpoint**: The Next.js API route at `/api/elevenlabs-accounts` (GET) that returns account metadata without exposing tokens.
- **ElevenLabs_Credits_Endpoint**: The Next.js API route at `/api/elevenlabs-credits` (GET) that fetches character usage/limits from the ElevenLabs subscription API.
- **ElevenLabs_Account_Library**: The server-side module at `lib/elevenlabs-accounts.ts` that reads `ELEVENLABS_ACCOUNTS` and `ELEVENLABS_VOICES` env vars and provides helper functions.
- **Enrich_Metadata_Endpoint**: The existing `/api/enrich-metadata` API route that calls OpenAI and saves enriched .txt files.
- **Frontend**: The main `app/page.tsx` client component containing all UI state and flow orchestration.
- **Header_Controls**: The top-right section of the UI containing dropdowns and credit badges.
- **LLM_Transcription**: The rewritten transcription field returned by OpenAI in the enrich step, stored in the `llmResult.videos` array.
- **Sanitized_Filename**: The filename produced by the `sanitizeFilename()` function, used consistently across .mp4, .txt, and .mp3 files.
- **Downloads_Folder**: The `downloads/` directory at the project root where all output files are saved.

## Requirements

### Requirement 1: ElevenLabs Account Library

**User Story:** As a developer, I want a server-side library for managing ElevenLabs accounts and voices from environment variables, so that the TTS integration follows the same multi-account pattern as Apify.

#### Acceptance Criteria

1. THE ElevenLabs_Account_Library SHALL export a `getElevenLabsAccounts()` function that parses the `ELEVENLABS_ACCOUNTS` env var (JSON array of `{id, label, token, default}`) and returns the typed array.
2. THE ElevenLabs_Account_Library SHALL export a `getTokenForElevenLabsAccount(accountId?)` function that returns the token for the specified account, falling back to the default account, then the first account.
3. THE ElevenLabs_Account_Library SHALL export a `getElevenLabsVoices()` function that parses the `ELEVENLABS_VOICES` env var (JSON array of `{id, name, default}`) and returns the typed array.
4. IF the `ELEVENLABS_ACCOUNTS` env var is missing or contains invalid JSON, THEN THE ElevenLabs_Account_Library SHALL return an empty array without throwing an error.
5. IF the `ELEVENLABS_VOICES` env var is missing or contains invalid JSON, THEN THE ElevenLabs_Account_Library SHALL return an empty array without throwing an error.

### Requirement 2: ElevenLabs Accounts API Endpoint

**User Story:** As a frontend developer, I want an API endpoint that returns ElevenLabs account metadata without exposing tokens, so that the UI can populate the TTS API dropdown.

#### Acceptance Criteria

1. WHEN a GET request is received, THE ElevenLabs_Accounts_Endpoint SHALL return a JSON response with `{ accounts: [{id, label, default}] }` for each configured ElevenLabs account.
2. THE ElevenLabs_Accounts_Endpoint SHALL exclude the `token` field from the response payload.

### Requirement 3: ElevenLabs Voices API

**User Story:** As a frontend developer, I want an API endpoint that returns the configured voice options, so that the UI can populate the Voice ID dropdown.

#### Acceptance Criteria

1. WHEN a GET request is received, THE ElevenLabs_Voices_Endpoint SHALL return a JSON response with `{ voices: [{id, name, default}] }` from the `ELEVENLABS_VOICES` env var.

### Requirement 4: ElevenLabs Credits API Endpoint

**User Story:** As a user, I want to see my remaining ElevenLabs character quota in the UI, so that I can monitor usage before running TTS generation.

#### Acceptance Criteria

1. WHEN a GET request with an optional `accountId` query parameter is received, THE ElevenLabs_Credits_Endpoint SHALL call the ElevenLabs subscription API using the resolved token and return `{ characterCount, characterLimit, characterRemaining }`.
2. IF the ElevenLabs API call fails, THEN THE ElevenLabs_Credits_Endpoint SHALL return a JSON error response with status 500.

### Requirement 5: Generate TTS API Endpoint

**User Story:** As a pipeline operator, I want an API endpoint that converts text to speech via ElevenLabs and saves the MP3 file, so that audio generation can be triggered from the frontend.

#### Acceptance Criteria

1. WHEN a POST request with `{ text, title, accountId, voiceId }` is received, THE Generate_TTS_Endpoint SHALL call the ElevenLabs TTS API with the provided text and voiceId using the resolved account token.
2. THE Generate_TTS_Endpoint SHALL save the returned audio as `{Sanitized_Filename}.mp3` in the Downloads_Folder, using the same `sanitizeFilename()` logic as the video and txt files.
3. WHEN the TTS API call succeeds, THE Generate_TTS_Endpoint SHALL return `{ status: "ok", filename }`.
4. IF the TTS API call fails, THEN THE Generate_TTS_Endpoint SHALL return a JSON error response with the error message and status 500.
5. IF the Downloads_Folder does not exist, THEN THE Generate_TTS_Endpoint SHALL create it before saving the file.

### Requirement 6: Enrich Metadata Endpoint Returns LLM Videos

**User Story:** As a frontend developer, I want the enrich-metadata response to include the raw LLM videos array, so that the frontend can iterate over each LLM_Transcription and send it to the TTS endpoint.

#### Acceptance Criteria

1. THE Enrich_Metadata_Endpoint SHALL include `llmVideos` (the `llmResult.videos` array) in the successful JSON response, in addition to the existing `savedFiles`, `errors`, and `debugLogs` fields.

### Requirement 7: TTS Generation in Run AI Flow

**User Story:** As a user, I want the "Run AI" button to automatically generate MP3 audio for each video after the OpenAI enrich step completes, so that I get both enriched text and audio in one action.

#### Acceptance Criteria

1. WHEN the OpenAI enrich step completes successfully in the Run AI flow, THE Frontend SHALL iterate over the returned `llmVideos` array and send each item's LLM_Transcription to the Generate_TTS_Endpoint sequentially (one at a time).
2. WHILE processing TTS for each video, THE Frontend SHALL display a status message indicating the current video index (e.g., "Generating TTS 2 of 5...").
3. WHEN a video's LLM_Transcription starts with "ERRO:", THE Frontend SHALL skip that item, add a log entry to the execution log, and continue to the next item.
4. IF the OpenAI enrich step fails (HTTP error), THEN THE Frontend SHALL stop the entire Run AI flow, display the OpenAI error, and skip TTS generation entirely.

### Requirement 8: TTS Generation in Download All Flow

**User Story:** As a user, I want the "Download All" button to generate MP3 audio after the OpenAI enrich step and before video downloads, so that the complete pipeline produces text, audio, and video files.

#### Acceptance Criteria

1. WHEN the OpenAI enrich step completes successfully in the Download All flow, THE Frontend SHALL iterate over the returned `llmVideos` array and send each item's LLM_Transcription to the Generate_TTS_Endpoint sequentially (one at a time), before proceeding to video downloads.
2. IF the OpenAI enrich step fails (HTTP error) in the Download All flow, THEN THE Frontend SHALL stop the entire flow immediately — no TTS generation, no video downloads — and display the OpenAI error to the user.
3. WHEN a video's LLM_Transcription starts with "ERRO:" during the Download All flow, THE Frontend SHALL skip that item, add a log entry, and continue to the next item.

### Requirement 9: Header UI — Voice ID Dropdown

**User Story:** As a user, I want a Voice ID dropdown in the header, so that I can select which ElevenLabs voice to use for TTS generation.

#### Acceptance Criteria

1. THE Frontend SHALL display a "Voice ID" dropdown in the Header_Controls, populated with options from the `ELEVENLABS_VOICES` env var via the voices API.
2. THE Frontend SHALL pre-select the voice marked as `default: true` on initial load.
3. THE Frontend SHALL position the Voice ID dropdown as the second item in the Header_Controls (after the Settings icon, before the TTS API dropdown).

### Requirement 10: Header UI — TTS API Dropdown

**User Story:** As a user, I want a TTS API dropdown in the header to select which ElevenLabs account to use, so that I can switch between accounts.

#### Acceptance Criteria

1. THE Frontend SHALL display a "TTS API" dropdown in the Header_Controls, populated with ElevenLabs accounts from the accounts API.
2. THE Frontend SHALL display the TTS API dropdown even when only one account is configured (unlike the Apify dropdown which hides with a single account).
3. THE Frontend SHALL position the TTS API dropdown as the third item in the Header_Controls (after Voice ID, before ElevenLabs credits badge).
4. THE Frontend SHALL pre-select the account marked as `default: true` on initial load.

### Requirement 11: Header UI — ElevenLabs Credits Badge

**User Story:** As a user, I want to see my remaining ElevenLabs character quota in the header, so that I can monitor usage at a glance.

#### Acceptance Criteria

1. THE Frontend SHALL display an ElevenLabs credits badge in the Header_Controls showing the remaining character count.
2. WHEN the selected ElevenLabs account changes, THE Frontend SHALL automatically refresh the credits badge by calling the ElevenLabs_Credits_Endpoint with the new accountId.
3. THE Frontend SHALL position the ElevenLabs credits badge as the fourth item in the Header_Controls (after TTS API dropdown, before Transcription API dropdown).

### Requirement 12: Header UI — Reordered Layout

**User Story:** As a user, I want the header controls in a specific left-to-right order, so that related controls are grouped logically.

#### Acceptance Criteria

1. THE Frontend SHALL render the Header_Controls items in this exact left-to-right order: (1) Settings icon, (2) Voice ID dropdown, (3) TTS API dropdown, (4) ElevenLabs credits badge, (5) Transcription API dropdown, (6) Apify credits badge.
2. THE Frontend SHALL preserve the existing Transcription API dropdown visibility condition (`apifyAccounts.length > 1`) unchanged.

### Requirement 13: Non-Regression

**User Story:** As a user, I want all existing functionality to continue working after the TTS integration, so that no current features are broken.

#### Acceptance Criteria

1. THE Frontend SHALL preserve the existing behavior of the "Download Transcript", "Download selected videos", "Download all x5", and "Delete selected" buttons without modification.
2. THE Enrich_Metadata_Endpoint SHALL continue to return `savedFiles`, `errors`, `debugLogs`, and `downloadDir` fields unchanged.
3. THE Frontend SHALL continue to use the existing `sanitizeFilename()` pattern for consistent file naming across .mp4, .txt, and .mp3 files.
