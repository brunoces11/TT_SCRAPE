export type ChannelVideoRow = {
  videoId: string;
  title: string;
  description: string;
  views: number;
  likes: number;
  hashtags: string[];
  videoUrl: string;
  comments?: number;
  publishDate?: string;
};

export type TranscriptRow = {
  videoId: string;
  title: string;
  description: string;
  views: number;
  likes: number;
  hashtags: string[];
  videoUrl: string;
  transcript: string;
  transcriptStatus: "ok" | "failed";
};

export type FetchChannelRequest = {
  channelUrl: string;
  resultsPerPage?: number;
};

export type TranscribeRequest = {
  videoUrls: string[];
  language?: string;
};

export type ApiErrorResponse = {
  error: string;
};
