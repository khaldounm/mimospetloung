import { CLINIC } from "@/constants/clinic";
import { formatMoney } from "@/utils/format";
import { downloadCanvasPng } from "@/utils/download-image";
import type { InvoiceDTO } from "@/types/entities";

// Pocket thermal printers (Tiny Print X6h etc.) print from a companion app that
// rasterises an image onto the roll. Feeding it an image sized to the printer's
// exact dot width prints 1:1 with no scaling or corner-clustering. A 58mm head
// at 203 DPI is 384 dots wide, so we render the receipt onto a 384px canvas.
const WIDTH = 384;
const PAD = 16;
const RIGHT = WIDTH - PAD;
const BASE = 16;
const NAME = 24;
const SMALL = 15;
const STRONG = 20;

function font(px: number, bold = false): string {
  return `${bold ? "bold " : ""}${px}px "Courier New", monospace`;
}

function num(value: string | number): string {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Greedy word-wrap against a pixel width using the ctx's current font.
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

// Lays the receipt out onto ctx. With draw=false it only advances the y cursor
// (a measuring pass to size the canvas); with draw=true it paints. Returns the
// final y so the caller can set an exact canvas height.
function layout(
  ctx: CanvasRenderingContext2D,
  invoice: InvoiceDTO,
  draw: boolean,
): number {
  let y = PAD;
  const advance = (px: number) => (y += px * 1.4);

  const center = (text: string, px: number, bold = false) => {
    ctx.font = font(px, bold);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    if (draw && text) ctx.fillText(text, WIDTH / 2, y);
    advance(px);
  };

  // Centered text that shrinks to fit the content width, down to a floor. Used
  // for the clinic name, which can be longer than the roll at full size.
  const centerFit = (
    text: string,
    maxPx: number,
    minPx: number,
    bold = false,
  ) => {
    const avail = WIDTH - 2 * PAD;
    let px = maxPx;
    ctx.font = font(px, bold);
    while (px > minPx && ctx.measureText(text).width > avail) {
      px -= 1;
      ctx.font = font(px, bold);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    if (draw && text) ctx.fillText(text, WIDTH / 2, y);
    advance(px);
  };

  const left = (text: string, px: number, bold = false) => {
    ctx.font = font(px, bold);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (draw && text) ctx.fillText(text, PAD, y);
    advance(px);
  };

  const sep = () => {
    y += 5;
    if (draw) {
      ctx.save();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(PAD, y + 0.5);
      ctx.lineTo(RIGHT, y + 0.5);
      ctx.stroke();
      ctx.restore();
    }
    y += 9;
  };

  const totLine = (label: string, value: string, bold = false) => {
    const px = bold ? STRONG : BASE;
    ctx.font = font(px, bold);
    ctx.textBaseline = "top";
    if (draw) {
      ctx.textAlign = "left";
      ctx.fillText(label, PAD, y);
      ctx.textAlign = "right";
      ctx.fillText(value, RIGHT, y);
    }
    advance(px);
  };

  // Column geometry for the items table.
  const qtyX = PAD;
  const descX = PAD + 32;
  const priceRight = RIGHT - 76;
  const totalRight = RIGHT;
  const descWidth = priceRight - 8 - descX;

  // Header
  centerFit(CLINIC.name, NAME, 15, true);
  for (const line of CLINIC.addressLines.filter(Boolean)) center(line, SMALL);
  if (CLINIC.phone) center(CLINIC.phone, SMALL);
  if (CLINIC.website) center(CLINIC.website, SMALL);

  sep();

  const stamp = new Date().toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  left(stamp, BASE);
  left(`INVOICE# ${invoice.number}`, BASE, true);
  left(`Bill to: ${invoice.clientName}`, BASE);

  sep();

  // Table header
  ctx.font = font(BASE, true);
  ctx.textBaseline = "top";
  if (draw) {
    ctx.textAlign = "left";
    ctx.fillText("Qty", qtyX, y);
    ctx.fillText("Description", descX, y);
    ctx.textAlign = "right";
    ctx.fillText("Price", priceRight, y);
    ctx.fillText("Total", totalRight, y);
  }
  advance(BASE);
  sep();

  // Rows
  ctx.font = font(BASE);
  for (const item of invoice.lineItems) {
    ctx.font = font(BASE);
    const descLines = wrap(ctx, item.description, descWidth);
    if (draw) {
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(String(Number(item.quantity)), qtyX, y);
      ctx.fillText(descLines[0], descX, y);
      ctx.textAlign = "right";
      ctx.fillText(num(item.unitPrice), priceRight, y);
      ctx.fillText(num(item.lineTotal), totalRight, y);
    }
    advance(BASE);
    for (let i = 1; i < descLines.length; i++) {
      if (draw) {
        ctx.textAlign = "left";
        ctx.fillText(descLines[i], descX, y);
      }
      advance(BASE);
    }
  }

  sep();

  const discountAmount =
    (Number(invoice.subtotal) * Number(invoice.discountPct)) / 100;
  totLine("Subtotal", formatMoney(invoice.subtotal));
  if (Number(invoice.discountPct) > 0) {
    totLine(
      `Discount (${invoice.discountPct}%)`,
      `-${formatMoney(discountAmount)}`,
    );
  }
  if (Number(invoice.taxPct) > 0) {
    totLine(`Tax (${invoice.taxPct}%)`, formatMoney(invoice.taxAmount));
  }
  totLine("TOTAL", formatMoney(invoice.total), true);
  totLine("Paid", formatMoney(invoice.amountPaid));
  totLine("Balance due", formatMoney(invoice.balance), true);

  sep();
  left(`Items# ${invoice.lineItems.length}`, BASE);

  y += 6;
  center("♥ Thank you for your visit", BASE);

  return y + PAD;
}

// Renders the receipt to a 384px-wide PNG canvas (white background, black ink).
function buildCanvas(invoice: InvoiceDTO): HTMLCanvasElement {
  const measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) throw new Error("Canvas not supported");
  const height = Math.ceil(layout(measureCtx, invoice, false));

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.fillStyle = "#000";
  layout(ctx, invoice, true);
  return canvas;
}

// Renders the receipt to a 384px-wide PNG and downloads it as a real .png file,
// so it can be opened with the Tiny Print app the same way on any device.
export async function downloadReceiptImage(invoice: InvoiceDTO): Promise<void> {
  await downloadCanvasPng(buildCanvas(invoice), `receipt-${invoice.number}`);
}
