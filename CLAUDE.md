# Project: Reduction Planner

## Environment
- Frontend: Vue 3 + TypeScript + Pinia
- Package manager: npm (run from `frontend/` directory)
- Dev server: `cd frontend && npm run dev`
- Build: `cd frontend && npm run build`

## Architecture
Fully client-side Vue SPA. All image processing runs in the browser:
- IndexedDB for project storage (via idb-keyval)
- Canvas API for image manipulation (crop, flip, layer rendering)
- Web Worker for k-means color quantization
- fflate for ZIP export
