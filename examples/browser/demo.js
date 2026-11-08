// Loaded as an external module so the page works under script-src 'self'.
import { defineTelltaleElements } from './telltale/components/index.js';

document.addEventListener('telltale-shown', (e) => {
  document.documentElement.dataset.shown = String(Number(document.documentElement.dataset.shown ?? '0') + 1);
  void e;
});
defineTelltaleElements();
