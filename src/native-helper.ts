const HOST = 'com.otone.helper';
let pending: Promise<void> | undefined;
let closeConnection: ((error?: Error) => void) | undefined;
let session = 0;

async function isHealthy(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch('http://127.0.0.1:18742/health', { signal: controller.signal });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') return false;
    const value = body as { ok?: unknown; provider?: unknown; allowedOrigins?: unknown };
    return value.ok === true && value.provider === 'shazamio' && Array.isArray(value.allowedOrigins)
      && value.allowedOrigins.includes(`chrome-extension://${chrome.runtime.id}`);
  } catch { return false; }
  finally { clearTimeout(timer); }
}

function setupError(): Error {
  return new Error('Automatic helper startup is unavailable. Install the Anioto native helper once using scripts/install-native-helper.ps1, then reload Anioto.');
}

function openConnection(): Promise<void> {
  return new Promise((resolve, reject) => {
    let port: chrome.runtime.Port;
    try { port = chrome.runtime.connectNative(HOST); }
    catch { reject(setupError()); return; }

    let ready = false;
    const clear = () => {
      clearTimeout(timer);
      if (closeConnection === close) closeConnection = undefined;
    };
    const close = (error = new Error('The browser session closed.')) => {
      clear();
      if (!ready) reject(error);
      port.disconnect();
    };
    const timer = setTimeout(() => close(new Error('The local helper is taking too long to start. Reopen Anioto to retry.')), 20_000);
    closeConnection = close;
    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      clear();
      if (!ready) reject(error ? setupError() : new Error('The native helper closed before it was ready.'));
    });
    port.onMessage.addListener((raw: unknown) => {
      if (ready || closeConnection !== close) return;
      const response = raw && typeof raw === 'object' ? raw as { ok?: unknown; error?: unknown } : undefined;
      if (response?.ok === true) {
        ready = true;
        clearTimeout(timer);
        resolve();
      } else {
        const message = response?.error;
        close(new Error(typeof message === 'string' ? message.slice(0, 300) : 'The native helper could not start. Check the local helper setup.'));
      }
    });
    try { port.postMessage({ type: 'ensureHelper' }); }
    catch { close(setupError()); }
  });
}

export function releaseLocalHelper(): void {
  session += 1;
  closeConnection?.();
}

/** Called only by popup-open and identification, never browser/Windows startup. */
export function ensureLocalHelper(): Promise<void> {
  if (pending) return pending;
  const currentSession = session;
  pending = (async () => {
    const previous = closeConnection;
    if (previous && await isHealthy() && previous === closeConnection) return;
    if (session !== currentSession) throw new Error('The browser session closed.');
    closeConnection?.();
    try { await openConnection(); }
    catch (error) {
      // A separately started helper can still be used without the native host.
      if (session !== currentSession || !await isHealthy()) throw error;
    }
  })().finally(() => { pending = undefined; });
  return pending;
}
