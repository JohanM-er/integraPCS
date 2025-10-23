#!/bin/bash

# Start all services for local development using Nx
set -euo pipefail

echo "🚀 Starting integraPCS Development Environment (Nx)"
echo "🔧 Serving projects: api, web"
pnpm nx run-many -t serve --projects=api,web --parallel