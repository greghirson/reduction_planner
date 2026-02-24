#!/usr/bin/env bash
set -e

# Run backend and frontend dev servers concurrently
trap 'kill 0' EXIT

cd "$(dirname "$0")/.."

echo "Starting backend on :8001..."
uv run uvicorn backend.main:app --reload --port 8001 &

echo "Starting frontend on :5173..."
cd frontend && npm run dev &

wait
