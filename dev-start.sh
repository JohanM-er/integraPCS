#!/bin/bash

# Start all services for local development using Nx
set -euo pipefail

echo "🚀 Starting integraPCS Development Environment (Nx)"
echo "🔧 Serving projects: api, frontend"

# Run api:serve and frontend:dev in parallel
pnpm nx run api:serve &
pnpm nx run frontend:dev &

wait