export interface Song {
  title: string;
  artist: string;
  album?: string;
}

export interface AnimeMatch {
  id: number;
  title: string;
  romajiTitle?: string;
  sourceUrl: string;
  coverUrl?: string;
  type?: string;
  evidence: string;
  matchKind?: 'confirmed' | 'version' | 'possible';
  recordingReferenceUrl?: string;
}

export interface Result {
  song: Song;
  anime: AnimeMatch[];
}

export interface Job {
  id: string;
  stage: string;
  message: string;
  stageStartedAt?: number;
  startedAt?: number;
  finishedAt?: number;
  captureSeconds?: number;
  result?: Result;
  previewUrl?: string;
}

export type LocalRecognitionProvider = 'local-shazam' | 'songrec';
export type RecognitionProvider = 'audiotag' | 'audd' | LocalRecognitionProvider;

export function isLocalRecognitionProvider(value: unknown): value is LocalRecognitionProvider {
  return value === 'local-shazam' || value === 'songrec';
}

export interface Settings {
  auddConsent?: boolean;
  apiKey: string;
  remember: boolean;
  freeAccessConfirmed: boolean;
  provider?: RecognitionProvider;
}

export type ClientMessage =
  | { type: 'ENSURE_HELPER' }
  | { type: 'START' }
  | { type: 'TEST_CAPTURE' }
  | { type: 'CANCEL' }
  | { type: 'STATUS' }
  | { type: 'LOOKUP'; song: Song };

export type OffscreenMessage =
  | { target: 'offscreen'; type: 'OFFSCREEN_START'; id: string; streamId: string; provider?: RecognitionProvider; apiKey?: string }
  | { target: 'offscreen'; type: 'OFFSCREEN_TEST_CAPTURE'; id: string; streamId: string }
  | { target: 'offscreen'; type: 'OFFSCREEN_LOOKUP'; id: string; song: Song }
  | { target: 'offscreen'; type: 'OFFSCREEN_CANCEL'; id: string }
  | { target: 'offscreen'; type: 'OFFSCREEN_STATUS'; id: string };

export interface JobUpdateMessage {
  target: 'background';
  type: 'JOB_UPDATE';
  job: Job;
}

export const JOB_STORAGE_KEY = 'job';
export const SETTINGS_SESSION_KEY = 'settings';
export const SETTINGS_LOCAL_KEY = 'settings';

export function isSong(value: unknown): value is Song {
  if (typeof value !== 'object' || value === null) return false;
  const song = value as Partial<Song>;
  return typeof song.title === 'string' && song.title.trim().length > 0 &&
    typeof song.artist === 'string' && song.artist.trim().length > 0 &&
    (song.album === undefined || typeof song.album === 'string');
}
