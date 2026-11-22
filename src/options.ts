import { parsePersonal } from './personal';
import { isLocalRecognitionProvider } from './contracts';
import { storeConfig } from './release';
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const key=get<HTMLInputElement>('api-key'),remember=get<HTMLInputElement>('remember'),free=get<HTMLInputElement>('free-access'),provider=get<HTMLSelectElement>('provider'),statusElement=get('status');
async function load(){const local=await chrome.storage.local.get(['settings','preferredProvider']);const session=await chrome.storage.session.get('settings');const value=session.settings??local.settings??{};key.value=value.apiKey??'';remember.checked=Boolean(value.remember);free.checked=Boolean(value.freeAccessConfirmed);const saved=value.provider??local.preferredProvider;provider.value=isLocalRecognitionProvider(saved)?saved:'audiotag';}
function setupLocalSettings(): void {
  get('settings-form').onsubmit=async e=>{e.preventDefault();try{const settings={apiKey:key.value.trim(),remember:remember.checked,freeAccessConfirmed:free.checked,provider:isLocalRecognitionProvider(provider.value)?provider.value:'audiotag'};await chrome.storage.local.set({preferredProvider:settings.provider});await chrome.storage.local.remove('settings');await chrome.storage.session.remove('settings');await (settings.remember?chrome.storage.local:chrome.storage.session).set({settings});statusElement.textContent='Settings saved.';}catch{statusElement.textContent='Could not save settings.';}};
  get('forget').onclick=async()=>{await chrome.storage.local.remove('settings');await chrome.storage.session.remove('settings');key.value='';free.checked=false;statusElement.textContent='Key removed.';};
  get('helper-command').textContent = '.\\scripts\\start-helper.ps1 -ExtensionId ' + chrome.runtime.id;
  void load();
}

async function setupStoreSettings(helperUrl: string): Promise<void> {
  const cloudAvailable = Boolean(storeConfig?.recognitionUrl);
  const consent = get<HTMLInputElement>('audd-consent');
  if (!cloudAvailable) {
    consent.disabled = true;
    get('audd-settings').hidden = true;
  }
  get<HTMLAnchorElement>('install-companion').href = helperUrl;
  const saved = await chrome.storage.local.get(['preferredProvider', 'settings']);
  provider.value = isLocalRecognitionProvider(saved.preferredProvider) || (cloudAvailable && saved.preferredProvider === 'audd') ? saved.preferredProvider : 'songrec';
  consent.checked = cloudAvailable && saved.settings?.auddConsent === true;
  provider.disabled = false;
  get<HTMLButtonElement>('save-provider').disabled = false;
  get('settings-form').onsubmit = async event => {
    event.preventDefault();
    if (!isLocalRecognitionProvider(provider.value) && !(cloudAvailable && provider.value === 'audd')) {
      statusElement.textContent = 'This provider is not available in this release.';
      return;
    }
    try {
      await chrome.storage.local.set({ preferredProvider: provider.value, settings: { auddConsent: cloudAvailable && consent.checked } });
      statusElement.textContent = 'Settings saved.';
    } catch {
      statusElement.textContent = 'Could not save settings.';
    }
  };
}
get('override-form').onsubmit=async e=>{e.preventDefault();try{const entry=parsePersonal([{song:{title:get<HTMLInputElement>('song-title').value,artist:get<HTMLInputElement>('song-artist').value},anime:{title:get<HTMLInputElement>('anime-title').value,sourceUrl:get<HTMLInputElement>('anime-url').value}}])[0];const {overrides=[]}=await chrome.storage.local.get('overrides');await chrome.storage.local.set({overrides:parsePersonal([...overrides,entry])});statusElement.textContent='Personal match saved.';}catch{statusElement.textContent='Enter valid titles, artist and an HTTPS source link.';}};
get('export').onclick=async()=>{const {overrides=[]}=await chrome.storage.local.get('overrides');const url=URL.createObjectURL(new Blob([JSON.stringify(parsePersonal(overrides),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='anime-song-finder-matches.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
get<HTMLInputElement>('import').onchange=async()=>{try{const file=get<HTMLInputElement>('import').files?.[0];if(!file)return;if(file.size>1_000_000)throw new Error();const values=parsePersonal(JSON.parse(await file.text()));await chrome.storage.local.set({overrides:values});statusElement.textContent='Personal matches imported (replaced previous matches).';}catch{statusElement.textContent='Import failed: use a valid exported JSON file under 1 MB.';}};
get('clear-overrides').onclick=async()=>{await chrome.storage.local.remove('overrides');statusElement.textContent='Personal matches cleared.';};
if (storeConfig) void setupStoreSettings(storeConfig.helperUrl).catch(() => { statusElement.textContent = 'Could not load settings.'; });
else setupLocalSettings();

