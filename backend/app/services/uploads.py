"""
Shared helpers for files stored under the uploads directory.

Every code path that turns a URL or archive entry into a filesystem path under
``settings.uploads_dir`` should go through these helpers so that the path is
confined to the uploads directory and limited to known media types.
"""

from pathlib import Path, PurePosixPath

from fastapi import HTTPException, UploadFile

from app.config import settings

ALLOWED_IMAGE_EXTENSIONS = frozenset({".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"})
ALLOWED_AUDIO_EXTENSIONS = frozenset({".mp3", ".wav", ".ogg", ".webm"})
ALLOWED_UPLOAD_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_AUDIO_EXTENSIONS

UPLOADS_URL_PREFIX = "/uploads/"

# Uploaded files (notably SVG) are served from the app's own origin. This policy
# keeps them inert when opened directly: no scripts, no plugins, no navigation.
UPLOADS_CSP = (
    "sandbox; default-src 'none'; img-src 'self' data:; "
    "style-src 'unsafe-inline'; media-src 'self'"
)

READ_CHUNK_SIZE = 1024 * 1024


def uploads_root() -> Path:
    """Resolved absolute path of the uploads directory."""
    return Path(settings.uploads_dir).resolve()


def confine_to_uploads(path: Path) -> Path | None:
    """Resolve ``path`` and return it only if it lies inside the uploads directory."""
    root = uploads_root()
    try:
        resolved = path.resolve()
    except (OSError, RuntimeError):
        return None
    if resolved == root or not resolved.is_relative_to(root):
        return None
    return resolved


def resolve_upload_url(url: str) -> Path | None:
    """
    Map an ``/uploads/...`` URL to a file path inside the uploads directory.

    Returns None for anything that is not a plain uploads URL, escapes the
    uploads directory, or does not have an allowed media extension.
    """
    if not isinstance(url, str) or not url.startswith(UPLOADS_URL_PREFIX):
        return None
    relative = url.removeprefix(UPLOADS_URL_PREFIX)
    if not relative or "\\" in relative or "\x00" in relative:
        return None
    parts = PurePosixPath(relative).parts
    if any(part in ("..", ".") for part in parts):
        return None
    if PurePosixPath(relative).suffix.lower() not in ALLOWED_UPLOAD_EXTENSIONS:
        return None
    return confine_to_uploads(uploads_root() / relative)


async def read_upload_limited(file: UploadFile, max_bytes: int, label: str | None = None) -> bytes:
    """Read an upload in chunks, aborting with 400 as soon as it exceeds ``max_bytes``."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(READ_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            name = f": {label}" if label else ""
            raise HTTPException(
                status_code=400,
                detail=f"File too large{name}. Max size: {max_bytes // 1024 // 1024}MB",
            )
        chunks.append(chunk)
    return b"".join(chunks)
