type BrowserApi = typeof chrome;
export {};
const api = (globalThis as typeof globalThis & { browser?: BrowserApi }).browser ?? globalThis.chrome;
const button = document.getElementById('open-workspace') as HTMLButtonElement;
const statusElement = document.getElementById('status') as HTMLElement;

button.addEventListener('click', () => {
  button.disabled = true;
  try {
    void api.tabs.create({ url: api.runtime.getURL('workspace.html') }).catch(() => {
      statusElement.textContent = 'Could not open the workspace. Try opening it from the extension menu again.';
      button.disabled = false;
    });
  } catch {
    statusElement.textContent = 'Could not open the workspace. Try opening it from the extension menu again.';
    button.disabled = false;
  }
});
