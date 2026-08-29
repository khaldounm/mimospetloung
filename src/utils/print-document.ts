// The single way this app puts anything on paper. Every print CTA funnels here
// so they all behave identically: no popup window, no tab flash, no leftover
// document, and the same wait-for-assets rule before the print is fired.
//
// Why an iframe and not window.open: a popup is blocked unless the click is
// trusted, it steals focus, and on a counter machine it leaves a stray window
// behind when the print is cancelled. A hidden iframe has none of those.
//
// ROLL STATIONERY: a receipt has no fixed height, but CSS has no way to say
// so. `@page { size: 80mm auto }` looks like it should work and is in fact
// invalid: the grammar is `<length>{1,2} | auto | <page-size>`, so a length
// next to the keyword matches nothing, the declaration is dropped, and the job
// silently falls back to A4. The only correct way to get a page exactly as long
// as its content is to render first, measure, then state both lengths.
//
// CLICK AND FORGET: the browser, not this code, decides whether a dialog is
// shown. window.print() is the only way a page can print, and it always raises
// the native dialog unless the browser was launched with kiosk printing on
// (Chrome/Edge: --kiosk-printing), which sends the job straight to the system
// default printer. That flag is why this helper waits for assets and keeps the
// document to a single @page size: in kiosk mode nobody is there to notice a
// half-rendered label or a wrong paper size before it hits the roll.

// Fires the print once the document has actually finished rendering. Text-only
// receipts are ready immediately, but a label carries a barcode <img> and
// printing before it decodes puts blank paper through the roll.
function whenReady(doc: Document, run: () => void): void {
  const images = Array.from(doc.images);
  const pending = images.filter((img) => !img.complete);

  // Never leave the job unfired because one asset never resolves.
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    run();
  };

  if (pending.length === 0) {
    fire();
    return;
  }

  let left = pending.length;
  const settle = () => {
    left -= 1;
    if (left === 0) fire();
  };
  for (const img of pending) {
    img.addEventListener("load", settle, { once: true });
    img.addEventListener("error", settle, { once: true });
  }
  setTimeout(fire, 3000);
}

// CSS px are 1/96 inch by definition, which is what makes a rendered height
// convertible to a real paper length.
const PX_TO_MM = 25.4 / 96;

// A hair of slack on the measured height. Sub-millimetre rounding must never be
// what decides whether the last line of a total makes it onto the paper.
const HEIGHT_SLACK_MM = 2;

export interface PrintOptions {
  // Width in mm of continuous roll stationery. Given this, the page height is
  // measured from the rendered document so the job is exactly as long as the
  // content: no second sheet, no blank feed to tear off. Leave unset for
  // documents that already declare a real @page size, such as A4 or a die-cut
  // label, and the document's own rule is used untouched.
  rollWidthMm?: number;
}

// Sizes the page to the content for roll stationery. Injected last so it wins
// the cascade over anything the document declared, and only once the document
// has finished rendering, since before that the height is not yet knowable.
function fitPageToContent(doc: Document, widthMm: number): void {
  const contentPx = Math.max(
    doc.documentElement.scrollHeight,
    doc.body?.scrollHeight ?? 0,
  );
  const heightMm = Math.ceil(contentPx * PX_TO_MM) + HEIGHT_SLACK_MM;
  const style = doc.createElement("style");
  style.textContent = `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`;
  doc.head.appendChild(style);
}

// Renders a standalone HTML document in a hidden iframe and prints it, leaving
// the current page untouched. The HTML owns its own @page size unless the
// caller asks for a roll width, in which case the page is fitted to content.
export function printHtmlDocument(
  html: string,
  { rollWidthMm }: PrintOptions = {},
): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  // Parked offscreen rather than collapsed to 0x0: the document has to be laid
  // out at its true paper width for the measured height to mean anything. The
  // height stays at 1px so scrollHeight reports content, not viewport.
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = rollWidthMm ? `${rollWidthMm}mm` : "210mm";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000);
  };
  win.onafterprint = cleanup;

  whenReady(doc, () => {
    if (rollWidthMm) fitPageToContent(doc, rollWidthMm);
    win.focus();
    win.print();
    // In kiosk-printing mode onafterprint is not guaranteed, and a cancelled
    // dialog may not fire it either. Sweep the iframe up regardless.
    setTimeout(cleanup, 60000);
  });
}
