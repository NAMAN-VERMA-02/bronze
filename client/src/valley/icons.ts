// Hand-drawn line icons for the Aurel Valley. 24×24, stroked in currentColor
// so they pick up the gold of the UI. No emoji, no icon fonts.

const svg = (body: string, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const ICON = {
  // Actions
  build: svg('<path d="M5 21V9l2-2V4h2v2h2V4h2v2h2V4h2v3l2 2v12"/><path d="M3 21h18"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/><path d="M9 11h.01M15 11h.01"/>'),
  route: svg('<path d="M3 15c3 0 3 2 6 2s3-2 6-2 3 2 6 2"/><path d="M3 19c3 0 3 2 6 2s3-2 6-2 3 2 6 2"/><path d="M6 13l2-6h8l2 6"/><path d="M12 7V3l4 2-4 2"/>'),
  run: svg('<path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7L3.5 14.5a2 2 0 0 0 0 3l3 3a2 2 0 0 0 3 0L17 13"/><path d="M8 18l-2-2"/>'),
  deliver: svg('<path d="M6 4h11a2 2 0 0 1 2 2v12"/><path d="M6 4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2z"/><path d="M8 7v11a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1H12v1a2 2 0 0 1-4 0"/><path d="M11 9h5M11 12h5"/><circle cx="16" cy="16" r="0.1"/>'),
  trade: svg('<path d="M12 3v18M7 21h10"/><path d="M4 7h16"/><path d="M4 7l-2.5 6a3 3 0 0 0 5 0z"/><path d="M20 7l-2.5 6a3 3 0 0 0 5 0z"/><circle cx="12" cy="4" r="1"/>'),
  bond: svg('<path d="M8 6h8l-1.5 3h-5z"/><path d="M9.5 9C5 11 4 15 5.5 18.5 6.4 20.4 8.4 21 12 21s5.6-.6 6.5-2.5C20 15 19 11 14.5 9"/><path d="M12 13v5M10.5 14.5h2.2a1.2 1.2 0 0 1 0 2.4h-2.4"/>'),
  wait: svg('<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 10 5 10 9s-10 4-10 9"/><path d="M17 3c0 5-10 5-10 9s10 4 10 9"/><path d="M10 18h4"/>'),
  // Currency, score, time
  mark: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6.2"/><path d="M12 8.2l3 3.8-3 3.8-3-3.8z"/>', 'mark'),
  glory: svg('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/><path d="M5 19h14"/><circle cx="12" cy="13.5" r="1.3"/>', 'glory'),
  time: svg('<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 10 5 10 9s-10 4-10 9"/><path d="M17 3c0 5-10 5-10 9s10 4 10 9"/>', 'time'),
  // Buildings
  mine: svg('<path d="M4 20l9-9"/><path d="M8.5 4.5C12 3 17 4 20 7c-3-1-6-.6-8 1"/><path d="M12 8l4 4"/>'),
  smelter: svg('<path d="M6 21h12l-1-9H7z"/><path d="M9 12V8h6v4"/><path d="M12 8c-2-2 0-4 0-5 2 1 3 3 1 5"/>'),
  forge: svg('<path d="M3 9h13a4 4 0 0 1-4 4H8l-1 3h8l1 4H6l1-4"/><path d="M16 9h5"/>'),
  // Interface
  map: svg('<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>'),
  throne: svg('<path d="M7 21V10l-2-6h14l-2 6v11"/><path d="M7 14h10M5 21h14"/><path d="M9 4l3 3 3-3"/>'),
  music: svg('<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  mute: svg('<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><path d="M3 3l18 18"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><path d="M12 17h.01"/>'),
  leave: svg('<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>'),
  anchor: svg('<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8"/><path d="M4 14a8 8 0 0 0 16 0"/>', 'small'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>', 'small'),
  check: svg('<path d="M5 12l5 5 9-10"/>', 'small'),
}

/** An amount in marks, e.g. coin(12) → [coin] 12 */
export const coin = (n: number) => `<span class="amt">${ICON.mark}${n}</span>`
export const glory = (n: number) => `<span class="amt">${ICON.glory}${n}</span>`

/** Turn engine text ("12 marks", "3 glory") into inline icons. Input must already be escaped. */
export function iconize(text: string): string {
  return text
    .replace(/(-?\d+) marks?/g, (_, n) => coin(Number(n)))
    .replace(/(-?\d+) glory/g, (_, n) => glory(Number(n)))
}
