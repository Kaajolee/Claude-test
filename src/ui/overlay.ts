export type Mode = 'gate' | 'gallery' | 'recruiter' | 'unity';

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in DOM`);
  return node as T;
};

export class Overlay {
  onEnter: () => void = () => {};
  onRecruiter: () => void = () => {};
  onExitRecruiter: () => void = () => {};
  onExitGallery: () => void = () => {};

  constructor() {
    el('enter').addEventListener('click', () => this.onEnter());
    el('recruiter').addEventListener('click', () => this.onRecruiter());
    el('back-to-gallery').addEventListener('click', () => this.onExitRecruiter());
    el('exit-hud').addEventListener('click', () => this.onExitGallery());
  }

  setMode(mode: Mode) {
    el('gate').hidden = mode !== 'gate';
    el('recruiter-view').hidden = mode !== 'recruiter';
    el('hud').hidden = mode !== 'gallery';
    el('unity-container').hidden = mode !== 'unity';
  }

  setHint(text: string) {
    el('hint').textContent = text;
  }

  setLoading(on: boolean) {
    el('loading').hidden = !on;
  }
}
