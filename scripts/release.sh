#!/usr/bin/env bash
set -euo pipefail

# Release script for Starship HUD
# Usage: ./scripts/release.sh [--dry-run]

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN=true
fi

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

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --staged --quiet; then
    if [ "$DRY_RUN" = false ]; then
        echo "Error: You have uncommitted changes. Please commit or stash them first."
        exit 1
    fi
fi

# Get current and new version
current_version=$(cat VERSION)
current_ym=$(echo "$current_version" | cut -d. -f1,2)
current_micro=$(echo "$current_version" | cut -d. -f3)
now_ym="$(date +%Y).$(date +%m)"
if [ "$current_ym" = "$now_ym" ]; then
    new_version="${now_ym}.$((current_micro + 1))"
else
    new_version="${now_ym}.0"
fi

# Generate changelog from git commits since last tag
last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$last_tag" ]; then
    changelog=$(git log "$last_tag"..HEAD --pretty=format:"- %s" --no-merges)
else
    changelog=$(git log --pretty=format:"- %s" --no-merges -20)
fi

if [ -z "$changelog" ]; then
    changelog="- Release $new_version"
fi

if [ "$DRY_RUN" = true ]; then
    echo "============================================================"
    echo "                   RELEASE DRY RUN                          "
    echo "============================================================"
    echo ""

    # Check REGISTRY_URL
    if [ -z "${REGISTRY_URL:-}" ]; then
        echo "[!] REGISTRY_URL: Not set (required for release)"
    else
        echo "[ok] REGISTRY_URL: $REGISTRY_URL"
    fi

    # Check for uncommitted changes
    if ! git diff --quiet || ! git diff --staged --quiet; then
        echo "[!] Git status: Uncommitted changes detected"
    else
        echo "[ok] Git status: Clean"
    fi

    echo ""
    echo "Version bump: $current_version -> $new_version"
    echo ""

    echo "[ Changelog preview ]"
    if [ -n "$last_tag" ]; then
        echo "Commits since $last_tag:"
    else
        echo "No previous tag found. Showing last 20 commits:"
    fi
    echo "$changelog"
    echo ""

    echo "[ Images that would be built ]"
    echo "  Frontend: $REGISTRY_URL-frontend:$new_version"
    echo "            $REGISTRY_URL-frontend:latest"
    echo "  Backend:  $REGISTRY_URL-backend:$new_version"
    echo "            $REGISTRY_URL-backend:latest"
    echo ""
    echo "Run 'just release' to execute this release."
    exit 0
fi

# Full release process
echo "============================================================"
echo "                    RELEASE PROCESS                         "
echo "============================================================"
echo ""
echo "Version: $current_version -> $new_version"
echo "Registry: $REGISTRY_URL"
echo ""

echo "[ Changelog (commits since last release) ]"
if [ -z "$last_tag" ]; then
    echo "(No previous tag found, showing last 20 commits)"
fi
echo "$changelog"
echo ""

# Confirm
read -p "Proceed with release? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Release cancelled."
    exit 0
fi

echo ""
echo "[ Step 1/6: Bumping version ]"
echo "$new_version" > VERSION
echo "Version set to $new_version"

echo ""
echo "[ Step 2/6: Committing version bump ]"
git add VERSION
git commit -m "release: v$new_version"

echo ""
echo "[ Step 3/6: Pushing commit ]"
git push

echo ""
echo "[ Step 4/6: Creating and pushing tag ]"
git tag -a "v$new_version" -m "Release v$new_version

$changelog"
git push origin "v$new_version"

echo ""
echo "[ Step 5/6: Building and pushing frontend container ]"
docker buildx build --platform linux/amd64 \
    -t "$REGISTRY_URL-frontend:$new_version" \
    -t "$REGISTRY_URL-frontend:latest" \
    -f ./frontend/Dockerfile ./frontend \
    --build-arg VITE_APP_VERSION="$new_version" \
    --push

echo ""
echo "[ Step 6/6: Building and pushing backend container ]"
docker buildx build --platform linux/amd64 \
    -t "$REGISTRY_URL-backend:$new_version" \
    -t "$REGISTRY_URL-backend:latest" \
    -f ./backend/Dockerfile ./backend \
    --build-arg APP_VERSION="$new_version" \
    --push

echo ""
echo "============================================================"
echo "                  RELEASE COMPLETE                          "
echo "============================================================"
echo ""
echo "Version:    v$new_version"
echo "Tag:        v$new_version"
echo "Frontend:   $REGISTRY_URL-frontend:$new_version"
echo "Backend:    $REGISTRY_URL-backend:$new_version"
echo ""
