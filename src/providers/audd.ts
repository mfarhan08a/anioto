import { isSong, type Song } from '../contracts';
import { storeConfig } from '../release';

export const AUDD_SAMPLE_SECONDS = 8;

export async function recognizeAudD(sample: Blob, signal: AbortSignal): Promise<Song[]> {
  if (!storeConfig) throw new Error('AudD is available in the store edition.');
  if (!storeConfig.recognitionUrl) throw new Error('AudD is not available in this release. Choose SongRec or Local Shazam in Settings.');
  let response: Response;
  try {
    response = await fetch(storeConfig.recognitionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: sample,
      credentials: 'omit',
      signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('AudD could not be reached. Try again or change the provider in Settings.');
  }
  if (response.status === 429) throw new Error('AudD’s usage limit has been reached. Change the provider in Settings or search manually.');
  if (!response.ok) throw new Error('AudD recognition is unavailable. Try again later or change the provider in Settings.');
  const result: unknown = await response.json().catch((error: unknown) => {
    if (signal.aborted) throw error;
    throw new Error('AudD returned an unreadable result. Try again or change the provider in Settings.');
  });
  if (result === null) return [];
  if (!isSong(result)) throw new Error('AudD returned an invalid song result.');
  return [result];
}
