#!/bin/bash
# Builds the NodeBookingApi image, pushes it to ACR, and tags the commit it was built from.
# Deploys nothing; restarting the service on the server is a separate step.
# Requires an active `az login` session.
#
# Usage:
#   ./publish.sh              # auto version: today's date + next free .N suffix
#   ./publish.sh 20260922.4   # explicit version
#   ./publish.sh --dry-run    # build only: no Azure, no push, no git tag

set -euo pipefail

REGISTRY="jpreg.azurecr.io"
IMAGE="node-booking-api"
ACR_NAME="jpreg"

DRY_RUN=0
VERSION=""

for arg in "$@"; do
  case "$arg" in
    --dry-run | -n) DRY_RUN=1 ;;
    -*)
      echo "Error: unknown option $arg" >&2
      exit 1
      ;;
    *) VERSION="$arg" ;;
  esac
done

cd "$(dirname "$0")"

# Refuse to tag a commit that doesn't match what actually gets built.
if [ "$DRY_RUN" -eq 0 ] && [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree has uncommitted changes. Commit or stash before deploying." >&2
  exit 1
fi

if [ -z "$VERSION" ]; then
  today=$(date +%Y%m%d)
  last=$(git tag -l "${today}.*" | sed "s/^${today}\.//" | sort -n | tail -1)
  VERSION="${today}.$((${last:-0} + 1))"
fi

TAG="${REGISTRY}/${IMAGE}:${VERSION}"

if [ "$DRY_RUN" -eq 0 ]; then
  if git rev-parse -q --verify "refs/tags/${VERSION}" > /dev/null; then
    echo "Error: tag ${VERSION} already exists." >&2
    exit 1
  fi

  az account show > /dev/null 2>&1 || {
    echo "Error: not logged in to Azure. Run az login first." >&2
    exit 1
  }

  echo "==> az acr login -n $ACR_NAME"
  az acr login -n "$ACR_NAME"
fi

echo "==> docker build -t $TAG"
docker build --platform linux/amd64 -t "$TAG" .

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run. Built $TAG; nothing pushed, nothing tagged."
  exit 0
fi

echo "==> docker push $TAG"
docker push "$TAG"

echo "==> git tag $VERSION"
git tag "$VERSION"
git push origin "$VERSION"

echo "Done. Published $TAG, pushed tag $VERSION."
