#!/bin/sh
# Runtime entry: apply Prisma migrations, then start the API (or exec "$@").
# npm/npx are stripped from the image — invoke the Prisma CLI via node.
# CI runtime smoke uses `docker run --entrypoint node` to skip migrate (no DB).
set -eu

if [ "${SKIP_DB_MIGRATE:-}" != "1" ]; then
  PRISMA_CLI="${PRISMA_CLI:-}"
  if [ -z "$PRISMA_CLI" ]; then
    if [ -f /app/node_modules/prisma/build/index.js ]; then
      PRISMA_CLI=/app/node_modules/prisma/build/index.js
    elif [ -f ./node_modules/prisma/build/index.js ]; then
      PRISMA_CLI=./node_modules/prisma/build/index.js
    else
      echo "prisma CLI not found (expected under /app/node_modules or ./node_modules)" >&2
      exit 1
    fi
  fi

  echo "Applying Prisma migrations (migrate deploy)..."
  node "$PRISMA_CLI" migrate deploy
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "Starting API..."
exec node dist/index.js
