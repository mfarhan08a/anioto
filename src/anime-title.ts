import type { AnimeMatch } from './contracts';

export function createAnimeTitleDisplay(
  { title, romajiTitle }: AnimeMatch,
  heading: 'h2' | 'h3',
  copyId?: string,
): HTMLDivElement {
  const display = document.createElement('div');
  const mainTitle = document.createElement(heading);
  mainTitle.className = 'anime-title';
  mainTitle.textContent = title;
  display.append(mainTitle);

  const compare = (value: string) => value.normalize('NFKC').trim().toLowerCase();
  const romaji = romajiTitle?.trim();
  const alternateTitle = romaji && compare(romaji) !== compare(title) ? romaji : undefined;
  if (alternateTitle) {
    const subtitle = document.createElement('p');
    subtitle.className = 'anime-romaji-title';
    subtitle.textContent = alternateTitle;
    display.append(subtitle);
  }

  const action = document.createElement('div');
  action.className = 'copy-title-action';

  const feedback = document.createElement('span');
  feedback.setAttribute('role', 'status');
  const addCopyButton = (label: string, value: string, id?: string) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary copy-title-button';
    if (id) button.id = id;
    button.textContent = label;
    button.setAttribute('aria-label', `${label} “${value}”`);
    button.onclick = async () => {
      feedback.textContent = '';
      try {
        await navigator.clipboard.writeText(value);
        feedback.textContent = 'Copied';
      } catch {
        feedback.textContent = 'Couldn’t copy. Select the title to copy it manually.';
      }
    };
    action.append(button);
  };
  addCopyButton(alternateTitle ? 'Copy English' : 'Copy title', title, copyId);
  if (alternateTitle) addCopyButton('Copy Romaji', alternateTitle, copyId ? `${copyId}-romaji` : undefined);
  action.append(feedback);
  display.append(action);
  return display;
}
