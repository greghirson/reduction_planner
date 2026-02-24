# Client-Side Migration Plan

Migrate the reduction planner from a FastAPI + Vue split to a fully client-side Vue app deployable on any static host (Cloudflare Pages, GitHub Pages, Netlify, etc.).

## Current Architecture

```
Browser (Vue SPA)  --->  FastAPI backend  --->  Filesystem
   UI only                Processing             projects_data/
                          File serving              project.json
                          State mgmt                original.png
                                                    cropped.png
                                                    quantized.png
                                                    flipped.png
                                                    palette.json
                                                    labels.npy
                                                    layers/
```

All image processing happens server-side with Python (Pillow, numpy, scikit-learn). Projects are stored as directories of files on disk.

## Target Architecture

```
Browser (Vue SPA)
   UI
   Processing (Canvas API + typed arrays)
   Storage (IndexedDB via idb-keyval or Dexie)
```

Everything runs in the browser. No backend, no server-side state.

---

## What the Backend Does Today

| Operation | Python libs | Complexity | Client-side replacement |
|-----------|------------|------------|------------------------|
| Upload + EXIF fix | Pillow | Trivial | Canvas API (browsers auto-handle EXIF in modern versions) |
| Crop | Pillow | Trivial | Canvas `drawImage` with source rect |
| K-means quantize | scikit-learn, numpy | **Heavy** | JS k-means lib or Web Worker |
| Palette replacement | numpy | Moderate | `Uint8Array` label lookup |
| Flip | Pillow | Trivial | Canvas `scale(-1,1)` / `scale(1,-1)` |
| Layer building | numpy, Pillow | Moderate | Typed array masks + Canvas |
| ZIP export | stdlib zipfile | Trivial | `fflate` or `JSZip` |
| Project CRUD + file serving | FastAPI, filesystem | Trivial | IndexedDB + Blob URLs |

---

## Migration Phases

### Phase 1: Storage Layer

Replace filesystem project storage with IndexedDB.

**New file: `frontend/src/services/storage.ts`**

Store each project as an IndexedDB record:

```
{
  id: string
  name: string
  state: string
  color_count?: number
  palette?: number[][]
  layer_order?: number[]
  h_flip?: boolean
  v_flip?: boolean
  images: {
    original: Blob
    cropped?: Blob
    quantized?: Blob
    flipped?: Blob
    layers?: Blob[]   // layer_0, layer_1, ...
  }
  labels?: Uint8Array  // replaces labels.npy — pixel-to-palette-index map
}
```

Use `idb-keyval` (tiny) or `Dexie` (more featured) for IndexedDB access. Blob URLs (`URL.createObjectURL`) replace the image-serving endpoint.

**Changes to existing code:**
- `frontend/src/stores/project.ts` — calls storage service instead of API client
- `frontend/src/api/client.ts` — deleted entirely
- `imageUrl()` helper replaced with a store getter that returns Blob URLs
- `vite.config.ts` — remove API proxy

### Phase 2: Trivial Processing (Crop, Flip, Export)

Move the simple image operations into browser-side service modules.

**New file: `frontend/src/services/cropper.ts`**
- Load original Blob into an `Image` element
- Draw onto a canvas with `ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)`
- Export canvas to Blob (`canvas.toBlob`)
- Clear downstream artifacts in IndexedDB
- Note: `cropperjs` (already in the project) handles the interactive UI; this service just does the final pixel crop

**New file: `frontend/src/services/flipper.ts`**
- Load quantized Blob into canvas
- Apply flips via `ctx.translate` + `ctx.scale(-1, 1)` for horizontal, `ctx.scale(1, -1)` for vertical
- Export to Blob

**New file: `frontend/src/services/exporter.ts`**
- Collect quantized + layer Blobs from IndexedDB
- Bundle into ZIP using `fflate` (fast, small, no dependencies)
- Trigger download via `<a href="blob:..." download="...">`

**New dependency:** `fflate` (~8KB gzipped)

### Phase 3: Quantization (the hard part)

This is the most computationally expensive operation and the core of the migration.

**New file: `frontend/src/services/quantizer.ts`**

**K-means approach:**
1. Read pixel data from canvas (`ctx.getImageData`)
2. Run k-means clustering on RGB values to find N-1 cluster centers
3. Append white `[255, 255, 255]` as the fixed base color
4. Assign each pixel to the nearest palette color (Euclidean distance in RGB)
5. Store the labels array (`Uint8Array`, one byte per pixel) in IndexedDB
6. Render the quantized image to a canvas and export to Blob

**K-means implementation options (pick one):**

| Option | Size | Notes |
|--------|------|-------|
| Hand-rolled k-means in a Web Worker | 0KB added | ~50 lines of code, sufficient for this use case |
| `skmeans` npm package | ~3KB | Simple, no dependencies |
| WASM-compiled implementation | Varies | Overkill unless performance is a problem |

**Recommendation:** Hand-roll it in a Web Worker. K-means for 2-12 clusters on image pixels is straightforward — the sklearn version is just MiniBatchKMeans which is a simplified variant anyway.

**Web Worker setup:**
- `frontend/src/workers/quantize.worker.ts`
- Receives: `ImageData` pixels + color count
- Returns: palette (`number[][]`) + labels (`Uint8Array`)
- Runs off the main thread so the UI stays responsive
- Report progress back via `postMessage` for a progress indicator

**Palette replacement:**
- Already has `labels` stored — just map `labels[i] -> newPalette[labels[i]]` to get new pixel colors
- Pure typed array operation, very fast in JS
- No Web Worker needed for this

### Phase 4: Layer Building

**New file: `frontend/src/services/layerBuilder.ts`**

Port the numpy-based layer builder to typed arrays:

1. Load quantized (or flipped) image into canvas, get `ImageData`
2. Compute pixel-to-palette assignment via Euclidean distance (same as quantizer — or reuse stored labels)
3. Sort palette by luminance (darkest first, white last)
4. For each layer N: create a white canvas, paint all pixels from layers 0..N in layer N's color
5. Export each layer canvas to Blob, store in IndexedDB

This is O(pixels * colors) for label assignment plus O(pixels * layers) for rendering. Moderate cost, but should be fine without a Worker for typical image sizes. Move to a Worker if profiling shows jank.

### Phase 5: Update Components

Update Vue components to work with the new service layer instead of API calls.

**`frontend/src/stores/project.ts`:**
- Replace all `api.*` calls with calls to the new service modules
- Image URLs become Blob URLs managed by the store
- `imageVersion` cache-busting no longer needed (Blob URLs are unique)
- Add `imageUrls` computed property: `{ original: string, cropped?: string, quantized?: string, flipped?: string, layers?: string[] }`
- Revoke old Blob URLs on update to prevent memory leaks (`URL.revokeObjectURL`)

**`frontend/src/views/EditorView.vue`:**
- Replace `imageUrl(project.id, 'filename.png')` with store-provided Blob URLs
- Remove `?v=` cache-busting suffixes

**`frontend/src/components/CropPanel.vue`:**
- `cropperjs` already works client-side — it just needs a Blob URL instead of a server URL for the source image
- On confirm, call the new cropper service instead of the API

**`frontend/src/components/QuantizationPanel.vue`:**
- Call quantizer service instead of API
- Optionally show a progress bar during k-means (Web Worker can post progress)

**`frontend/src/components/FlipPanel.vue`:**
- Call flipper service instead of API

**`frontend/src/components/LayerViewer.vue`:**
- Layer images come from Blob URLs in the store instead of `imageUrl()`

**`frontend/src/components/ExportPanel.vue`:**
- Call exporter service to generate ZIP Blob
- Use `<a :href="zipBlobUrl" download="...">` instead of server URL

### Phase 6: Cleanup

- Delete `backend/` directory entirely
- Delete `frontend/src/api/client.ts`
- Remove Vite proxy config
- Update `pyproject.toml` / `uv.lock` or remove them
- Update README with new deployment instructions

---

## New Dependencies

| Package | Purpose | Size (gzipped) |
|---------|---------|----------------|
| `idb-keyval` | Simple IndexedDB wrapper | ~1KB |
| `fflate` | ZIP creation for export | ~8KB |

No other new dependencies needed. K-means can be hand-rolled. All image manipulation uses the native Canvas API.

---

## File Map: Old to New

| Backend file (deleted) | Frontend replacement (new) |
|----------------------|---------------------------|
| `backend/services/project_manager.py` | `frontend/src/services/storage.ts` |
| `backend/services/cropper.py` | `frontend/src/services/cropper.ts` |
| `backend/services/quantizer.py` | `frontend/src/services/quantizer.ts` + `frontend/src/workers/quantize.worker.ts` |
| `backend/services/flipper.py` | `frontend/src/services/flipper.ts` |
| `backend/services/layer_builder.py` | `frontend/src/services/layerBuilder.ts` |
| `backend/services/exporter.py` | `frontend/src/services/exporter.ts` |
| `backend/routers/*.py` | (eliminated — no API layer) |
| `backend/models/schemas.py` | TypeScript interfaces in store/services |
| `backend/main.py` | (eliminated) |
| `frontend/src/api/client.ts` | (eliminated) |

---

## Migration Order & Rationale

```
Phase 1 (Storage)       -- Foundation. Everything else depends on this.
  |
Phase 2 (Crop/Flip/Export) -- Low-risk, builds confidence in the pattern.
  |
Phase 3 (Quantization)  -- Highest risk. Core algorithm + Web Worker.
  |
Phase 4 (Layer Building) -- Depends on quantizer output format being stable.
  |
Phase 5 (Components)    -- Wire everything together.
  |
Phase 6 (Cleanup)       -- Remove backend.
```

Phases 2, 3, and 4 can be developed in parallel since they're independent services, but should be integrated in order.

---

## Risks & Mitigations

**Performance of client-side k-means on large images**
- Mitigation: Web Worker keeps UI responsive. Downsample for clustering (e.g., sample 50K pixels), then assign all pixels to nearest centroid. This is what MiniBatchKMeans already does conceptually.

**IndexedDB storage limits**
- Typical browser limit: 50-80% of free disk space (effectively unlimited for this use case)
- Each project is a few MB at most (original image + derived PNGs)
- Mitigation: show storage usage, allow manual cleanup

**Browser compatibility for Canvas operations**
- Canvas API is universally supported in modern browsers
- EXIF auto-orientation: supported in Chrome 81+, Firefox 77+, Safari 13.1+
- Web Workers: universally supported
- Mitigation: none needed for modern browsers

**Memory pressure with large images**
- A 4000x3000 RGBA image is ~48MB in memory as ImageData
- Multiple copies during processing could spike to ~200MB
- Mitigation: process in sequence (not parallel), release references promptly, consider downscaling the working image if the source is very large

---

## Deployment

After migration, the app is a static Vue SPA. Build and deploy:

```bash
cd frontend
npm run build    # outputs to dist/
```

Deploy `dist/` to any static host:
- **Cloudflare Pages:** connect repo, build command `cd frontend && npm run build`, output dir `frontend/dist`
- **GitHub Pages:** push `dist/` to `gh-pages` branch or use GitHub Actions
- **Netlify:** same as Cloudflare Pages

Add a `_redirects` or equivalent for SPA routing (all paths -> `index.html`).
