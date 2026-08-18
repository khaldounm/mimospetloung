// Renders a canvas to a PNG file and downloads it, so it can be opened with an
// external app (e.g. the Tiny Print pocket-printer app). Shared by the receipt
// and barcode-label "Tiny Print" actions so both behave identically.
export async function downloadCanvasPng(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Could not render the image");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
