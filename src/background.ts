import { JOB_STORAGE_KEY, SETTINGS_LOCAL_KEY, SETTINGS_SESSION_KEY, isLocalRecognitionProvider, isSong } from './contracts';
import type { ClientMessage, Job, Settings, Song } from './contracts';
import { ensureLocalHelper, releaseLocalHelper } from './native-helper';

const OFFSCREEN_URL = 'offscreen.html';
const ACTIVE_STAGES = new Set(['capturing', 'listening and recognizing', 'submitting', 'awaiting recognition', 'resolving anime']);
const AUDIOTAG_DAILY_CAPTURE_LIMIT = 20;
let activeId: string | undefined;
let targetTabId: number | undefined;
let startingCapture: symbol | undefined;
let cancelling: Promise<void> | undefined;

chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  const message = raw as Partial<ClientMessage>;
  if (message.type === 'ENSURE_HELPER') {
    void prepareHelper().then(localReady => sendResponse({ ok: true, localReady }), (error: unknown) => sendResponse({ error: errorMessage(error) }));
    return true;
  }
  if (message.type === 'CANCEL') {
    void cancelJob().then(() => sendResponse({ ok: true }), (error: unknown) => sendResponse({ error: errorMessage(error) }));
    return true;
  }
  if (message.type === 'STATUS') {
    void readJob().then((job) => sendResponse({ job }));
    return true;
  }
  if (message.type === 'START') {
    void startCapture().then(sendResponse, (error: unknown) => sendResponse({ error: errorMessage(error) }));
    return true;
  }
  if (message.type === 'TEST_CAPTURE') {
    void startCapture(true).then(sendResponse, (error: unknown) => sendResponse({ error: errorMessage(error) }));
    return true;
  }
  if (message.type === 'LOOKUP' && isSong(message.song)) {
    void startLookup(message.song).then(sendResponse, (error: unknown) => sendResponse({ error: errorMessage(error) }));
    return true;
  }
});

chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  const message = raw as { target?: string; type?: string; job?: Job };
  if (sender.id !== chrome.runtime.id || message.target !== 'background' || message.type !== 'JOB_UPDATE' || !message.job) return;
  void readJob().then(async (current) => {
    if (current && current.id === message.job?.id && (
      ACTIVE_STAGES.has(current.stage) || (current.stage === 'sample-ready' && message.job?.stage === 'sample-expired')
    )) await storeJob(message.job as Job);
    sendResponse({ ok: true });
  }, () => sendResponse({ error: 'Could not read job state.' })).catch(() => sendResponse({ error: 'Could not save job state.' }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === targetTabId) void cancelJob();
});

chrome.windows.onRemoved.addListener(() => {
  void chrome.windows.getAll({ windowTypes: ['normal', 'popup'] }).then(windows => {
    if (!windows.length) releaseLocalHelper();
  }).catch(() => { /* Browser exit also closes the native connection. */ });
});

chrome.runtime.onStartup.addListener(() => { void recoverJob(); });
chrome.runtime.onInstalled.addListener(() => { void recoverJob(); });
void recoverJob();

async function startCapture(diagnostic = false): Promise<{ ok: true; job: Job } | { error: string }> {
  if (cancelling) await cancelling;
  if (startingCapture) return { error: 'An identification is already starting.' };
  const attempt = Symbol();
  startingCapture = attempt;
  try {
  const prior = await readJob();
  if (prior && ACTIVE_STAGES.has(prior.stage)) {
    return diagnostic ? { error: 'Another capture or lookup is already in progress.' } : { ok: true, job: prior };
  }
  const settings = diagnostic ? undefined : await readSettings();
  const provider = settings?.provider ?? 'audiotag';
  if (!diagnostic && isLocalRecognitionProvider(provider)) await ensureLocalHelper();
  if (!diagnostic && provider === 'audiotag' && !settings?.freeAccessConfirmed) return { error: 'Confirm the provider’s free access and usage terms in Settings before uploading audio.' };
  if (!diagnostic && provider === 'audiotag' && !settings?.apiKey.trim()) return { error: 'Add your AudioTag API key in Settings.' };
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return { error: 'No active browser tab is available.' };
  if (!diagnostic && provider === 'audiotag') {
    const usage = await chrome.storage.local.get('dailyUsage');
    const today = localDateKey();
    const current = usage.dailyUsage as { date?: string; count?: number } | undefined;
    const count = current?.date === today ? current.count ?? 0 : 0;
    if (count >= AUDIOTAG_DAILY_CAPTURE_LIMIT) return { error: `The AudioTag local limit of ${AUDIOTAG_DAILY_CAPTURE_LIMIT} capture attempts per day has been reached.` };
    await chrome.storage.local.set({ dailyUsage: { date: today, count: count + 1 } });
  }
  const id = crypto.randomUUID();
  const captureSeconds = !diagnostic && isLocalRecognitionProvider(provider) ? 12 : 15;
  const providerName = provider === 'songrec' ? 'SongRec' : provider === 'local-shazam' ? 'ShazamIO' : 'AudioTag';
  const job: Job = { id, stage: 'capturing', captureSeconds, message: diagnostic ? 'Preparing a local 15-second audio capture.' : `Preparing to capture up to ${captureSeconds} seconds of tab audio for ${providerName}.` };
  activeId = id;
  targetTabId = tab.id;
  await chrome.storage.session.set({ captureTabId: tab.id });
  await storeJob(job);
  try {
    await ensureOffscreen();
    if (activeId !== id) return { ok: true, job: await readJob() ?? job };
    const streamId = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Edge/Chrome did not provide a tab audio stream within 8 seconds. Reload the extension and try again on a playing media tab.')), 8_000);
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (value) => {
        clearTimeout(timer);
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message ?? 'Could not capture audio from this tab.'));
        else if (!value) reject(new Error('The browser returned an empty tab audio stream. Open a playing media tab and try again.'));
        else resolve(value);
      });
    });
    await cancelling;
    if (activeId !== id) return { ok: true, job: await readJob() ?? job };
    if (diagnostic) await chrome.runtime.sendMessage({ target: 'offscreen', type: 'OFFSCREEN_TEST_CAPTURE', id, streamId });
    else await chrome.runtime.sendMessage({
      target: 'offscreen', type: 'OFFSCREEN_START', id, streamId, provider,
      ...(provider === 'audiotag' ? { apiKey: settings!.apiKey } : {})
    });
  } catch (error) {
    if (activeId !== id) return { ok: true, job: await readJob() ?? job };
    await storeJob({ id, stage: 'failed', message: errorMessage(error) });
    throw error;
  }
  return { ok: true, job };
  } finally {
    if (startingCapture === attempt) startingCapture = undefined;
  }
}

async function prepareHelper(): Promise<boolean> {
  const settings = await readSettings();
  if (!isLocalRecognitionProvider(settings.provider)) return false;
  await ensureLocalHelper();
  return true;
}

async function startLookup(song: Song): Promise<{ ok: true; job: Job } | { error: string }> {
  await cancelling;
  const prior = await readJob();
  if (prior && ACTIVE_STAGES.has(prior.stage)) return { ok: true, job: prior };
  const id = crypto.randomUUID();
  const job: Job = { id, stage: 'resolving anime', message: 'Searching anime associations.' };
  activeId = id;
  await storeJob(job);
  try {
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'OFFSCREEN_LOOKUP', id, song });
  } catch (error) {
    await storeJob({ id, stage: 'failed', message: errorMessage(error) });
    throw error;
  }
  return { ok: true, job };
}

async function ensureOffscreen(): Promise<void> {
  const contexts = await new Promise<chrome.runtime.ExtensionContext[]>((resolve) => {
    chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT], documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)] }, resolve);
  });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({ url: OFFSCREEN_URL, reasons: [chrome.offscreen.Reason.USER_MEDIA], justification: 'Capture an explicitly selected tab audio sample and keep the bounded recognition job alive.' });
}

function cancelJob(): Promise<void> {
  cancelling ??= (async () => {
    const job = await readJob();
    if (!job || !ACTIVE_STAGES.has(job.stage)) return;
    const attempt = startingCapture;
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'OFFSCREEN_CANCEL', id: job.id }).catch(() => undefined);
    const current = await readJob();
    if (current?.id === job.id && ACTIVE_STAGES.has(current.stage)) {
      await storeJob({ id: job.id, stage: 'cancelled', message: 'Identification cancelled.' });
    }
    if (startingCapture === attempt) startingCapture = undefined;
  })().finally(() => { cancelling = undefined; });
  return cancelling;
}

async function readSettings(): Promise<Settings> {
  const [session, local] = await Promise.all([
    chrome.storage.session.get(SETTINGS_SESSION_KEY), chrome.storage.local.get([SETTINGS_LOCAL_KEY, 'preferredProvider'])
  ]);
  const sessionSettings = session[SETTINGS_SESSION_KEY] as Partial<Settings> | undefined;
  const localSettings = local[SETTINGS_LOCAL_KEY] as Partial<Settings> | undefined;
  return {
    apiKey: sessionSettings?.apiKey ?? (localSettings?.remember ? localSettings.apiKey ?? '' : ''),
    remember: localSettings?.remember ?? false,
    freeAccessConfirmed: sessionSettings?.freeAccessConfirmed ?? localSettings?.freeAccessConfirmed ?? false,
    provider: isProvider(sessionSettings?.provider) ? sessionSettings.provider :
      isProvider(local.preferredProvider) ? local.preferredProvider :
      isProvider(localSettings?.provider) ? localSettings.provider : 'audiotag'
  };
}

function isProvider(value: unknown): value is NonNullable<Settings['provider']> {
  return value === 'audiotag' || isLocalRecognitionProvider(value);
}

async function storeJob(job: Job): Promise<void> {
  const previous = await readJob();
  const now = Date.now();
  const sameJob = previous?.id === job.id;
  job = { ...job,
    startedAt: sameJob ? previous.startedAt ?? job.startedAt ?? now : job.startedAt ?? now,
    stageStartedAt: job.stageStartedAt ?? (sameJob && previous.stage === job.stage ? previous.stageStartedAt ?? now : now),
    ...(!ACTIVE_STAGES.has(job.stage) ? { finishedAt: sameJob ? previous.finishedAt ?? now : now } : {})
  };
  await chrome.storage.session.set({ [JOB_STORAGE_KEY]: job });
  if (job.result && ['complete', 'song-only'].includes(job.stage)) {
    const { history } = await chrome.storage.local.get('history');
    const entries = Array.isArray(history) ? history as Array<{ id?: string }> : [];
    if (!entries.some((item) => item.id === job.id)) {
      await chrome.storage.local.set({ history: [{ id: job.id, result: job.result }, ...entries].slice(0, 100) });
    }
  }
  if (job.id === activeId && !ACTIVE_STAGES.has(job.stage)) {
    activeId = undefined;
    targetTabId = undefined;
    void chrome.storage.session.remove('captureTabId');
  }
}

async function readJob(): Promise<Job | undefined> {
  const stored = await chrome.storage.session.get(JOB_STORAGE_KEY);
  return stored[JOB_STORAGE_KEY] as Job | undefined;
}

async function recoverJob(): Promise<void> {
  const job = await readJob();
  if (!job || !ACTIVE_STAGES.has(job.stage)) return;
  const capture = await chrome.storage.session.get('captureTabId');
  targetTabId = typeof capture.captureTabId === 'number' ? capture.captureTabId : undefined;
  const contexts = await new Promise<chrome.runtime.ExtensionContext[]>((resolve) => {
    chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT], documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)] }, resolve);
  });
  if (contexts.length) {
    const state = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'OFFSCREEN_STATUS', id: job.id }).catch(() => undefined);
    if (state?.running) { activeId = job.id; return; }
  }
  // A worker restart cannot safely restart capture or resubmit audio.
  activeId = job.id;
  await storeJob({ id: job.id, stage: 'failed', message: 'The extension worker restarted during this job. Start a new identification; audio was not resubmitted.' });
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'The extension could not start this request.'; }

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
