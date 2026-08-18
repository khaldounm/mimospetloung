import JsBarcode from "jsbarcode";
import { downloadCanvasPng } from "@/utils/download-image";

// 58mm at 203 DPI = 384 dots, matching the Tiny Print pocket-printer roll.
const WIDTH = 384;
const PAD = 14;
const NAME_SIZE = 20;
const GAP = 10;

// Composes the item name + centered barcode onto a white 384px-wide canvas,
// the same balanced layout as the print preview but sized for the pocket roll.
function buildLabelCanvas(barcode: string, name: string): HTMLCanvasElement {
  const bc = document.createElement("canvas");
  JsBarcode(bc, barcode, {
    format: "EAN13",
    width: 2,
    height: 60,
    fontSize: 16,
    margin: 10,
  });

  const scale = (WIDTH * 0.9) / bc.width;
  const bw = bc.width * scale;
  const bh = bc.height * scale;
  const height = Math.ceil(PAD + NAME_SIZE + GAP + bh + PAD);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `bold ${NAME_SIZE}px Arial, sans-serif`;
  ctx.fillText(name || "Unnamed item", WIDTH / 2, PAD, WIDTH - 2 * PAD);
  ctx.drawImage(bc, (WIDTH - bw) / 2, PAD + NAME_SIZE + GAP, bw, bh);
  return canvas;
}

// Downloads the barcode label as a PNG for the Tiny Print app.
export async function downloadBarcodeLabelImage(
  barcode: string,
  name: string,
): Promise<void> {
  await downloadCanvasPng(
    buildLabelCanvas(barcode, name),
    `barcode-${barcode}`,
  );
}
