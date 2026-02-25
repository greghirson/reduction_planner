# Reduction Planner

Plan your reduction block prints from start to finish. Upload a photo or image, reduce it to a limited color palette, arrange your layers, and export print-ready separations. You can also export an animated GIF preview to visualize the print build-up or share it with others.

Everything runs entirely in your browser — no data is ever sent to a server.

## What is reduction printing?

In reduction printmaking, a single block is carved and printed in stages. Each pass removes more material and adds a new color, building up the image layer by layer from lightest to darkest. Because the block is progressively cut away, the process is irreversible — you can't go back and reprint earlier layers.

Reduction Planner helps you prepare for this process digitally: see how your image breaks down into a limited palette, preview each layer in order, and export the separations you need before committing to the block.

## Workflow

The editor guides you through each step in order:

1. **Upload** — Import a photo or reference image to start a new project.
2. **Crop** — Frame your composition using preset aspect ratios (1:1, 4:5, 5:4, 3:2, 2:3) or a custom ratio.
3. **Background Removal** — Click to flood-fill areas you want to remove. Adjustable tolerance and fill color.
4. **Quantize** — Reduce the image to 2–12 colors using k-means clustering. Edit individual palette colors by clicking the swatches.
5. **Flip / Mirror** — Flip horizontally or vertically for print transfer layout.
6. **Layers** — Generate separation layers ordered by luminance (darkest first). Each layer shows cumulative ink coverage.
7. **Export** — Download all layers as PNGs in a ZIP file.
8. **GIF Preview** — Generate an animated GIF showing the layer build-up, with adjustable speed and output size.

## Running locally

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

To create a production build:

```bash
cd frontend
npm run build
```

The output goes to `frontend/dist/` and can be deployed to any static hosting provider.

## Tech stack

- **Vue 3** + TypeScript + Pinia for the UI and state management
- **Canvas API** for image manipulation (crop, flip, layer rendering, background removal)
- **Web Worker** for k-means color quantization (keeps the UI responsive)
- **IndexedDB** (via idb-keyval) for persistent project storage
- **gifenc** for animated GIF encoding
- **fflate** for ZIP export
- **Cropper.js** for the interactive crop tool
- **Vite** for development and builds

No backend, no external APIs, no accounts. All processing happens client-side.

## License

This project is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). You are free to use, share, and adapt it for non-commercial purposes with attribution.
