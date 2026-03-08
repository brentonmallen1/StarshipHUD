#!/usr/bin/env bash
set -euo pipefail

# Promotion script for Starship HUD container images
# Promotes an image (default: :dev) to :latest tag
# Usage: ./scripts/promote-latest.sh [--dry-run] [version]
#
# Examples:
#   ./scripts/promote-latest.sh                 # Promote :dev to :latest
#   ./scripts/promote-latest.sh --dry-run       # Show what would be promoted
#   ./scripts/promote-latest.sh 2026.02.5       # Promote specific version to :latest
#   ./scripts/promote-latest.sh --dry-run 2026.02.5

DRY_RUN=false
VERSION="dev"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            VERSION="$1"
            shift
            ;;
    esac
done

# Load .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

# Check for required REGISTRY_URL
if [ -z "${REGISTRY_URL:-}" ]; then
    echo "Error: REGISTRY_URL not set in .env"
    echo "Example: REGISTRY_URL=registry.example.com/starship-hud"
    exit 1
fi

SOURCE_TAG="$VERSION"
TARGET_TAG="latest"

if [ "$DRY_RUN" = true ]; then
    echo "============================================================"
    echo "              PROMOTION DRY RUN                             "
    echo "============================================================"
    echo ""
    echo "Registry:       $REGISTRY_URL"
    echo "Source tag:     :$SOURCE_TAG"
    echo "Target tag:     :$TARGET_TAG"
    echo ""
    echo "[ Images that would be promoted ]"
    echo "  Frontend: $REGISTRY_URL-frontend:$SOURCE_TAG → $REGISTRY_URL-frontend:$TARGET_TAG"
    echo "  Backend:  $REGISTRY_URL-backend:$SOURCE_TAG → $REGISTRY_URL-backend:$TARGET_TAG"
    echo ""
    echo "Note: This requires 'docker login' credentials for the registry."
    echo "Run 'just promote-latest $VERSION' to execute this promotion."
    exit 0
fi

# Full promotion process
echo "============================================================"
echo "                  PROMOTION PROCESS                         "
echo "============================================================"
echo ""
echo "Registry:       $REGISTRY_URL"
echo "Source tag:     :$SOURCE_TAG"
echo "Target tag:     :$TARGET_TAG"
echo ""

# Confirm
read -p "Proceed with promotion? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Promotion cancelled."
    exit 0
fi

echo ""
echo "[ Step 1/2: Promoting frontend image ]"
echo "  Pulling $REGISTRY_URL-frontend:$SOURCE_TAG"
docker pull "$REGISTRY_URL-frontend:$SOURCE_TAG"

echo "  Tagging as $REGISTRY_URL-frontend:$TARGET_TAG"
docker tag "$REGISTRY_URL-frontend:$SOURCE_TAG" "$REGISTRY_URL-frontend:$TARGET_TAG"

echo "  Pushing $REGISTRY_URL-frontend:$TARGET_TAG"
docker push "$REGISTRY_URL-frontend:$TARGET_TAG"

echo ""
echo "[ Step 2/2: Promoting backend image ]"
echo "  Pulling $REGISTRY_URL-backend:$SOURCE_TAG"
docker pull "$REGISTRY_URL-backend:$SOURCE_TAG"

echo "  Tagging as $REGISTRY_URL-backend:$TARGET_TAG"
docker tag "$REGISTRY_URL-backend:$SOURCE_TAG" "$REGISTRY_URL-backend:$TARGET_TAG"

echo "  Pushing $REGISTRY_URL-backend:$TARGET_TAG"
docker push "$REGISTRY_URL-backend:$TARGET_TAG"

echo ""
echo "============================================================"
echo "                  PROMOTION COMPLETE                        "
echo "============================================================"
echo ""
echo "Frontend:   $REGISTRY_URL-frontend:$TARGET_TAG"
echo "Backend:    $REGISTRY_URL-backend:$TARGET_TAG"
echo ""
echo "Both images now point to the same content as :$SOURCE_TAG"
echo ""
