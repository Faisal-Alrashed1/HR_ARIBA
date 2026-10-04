"""File storage. Only the storage path is kept in the database (never base64).

- Supabase Storage (private bucket) when SUPABASE_URL and the service-role key are set.
- A local folder in development/test otherwise (refused in production).

Files are always streamed back through the backend after a permission check, so the browser
never receives a storage URL or key.
"""

from pathlib import Path
from typing import Protocol

import httpx

from app.config import get_settings
from app.core.errors import ApiError


class Storage(Protocol):
    def put(self, path: str, data: bytes, content_type: str) -> None: ...
    def get(self, path: str) -> bytes: ...
    def delete(self, path: str) -> None: ...


class SupabaseStorage:
    def __init__(self) -> None:
        s = get_settings()
        self.base = f"{s.supabase_url}/storage/v1/object/{s.storage_bucket}"
        key = s.supabase_service_role_key
        self.headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    def put(self, path: str, data: bytes, content_type: str) -> None:
        r = httpx.post(
            f"{self.base}/{path}",
            headers={**self.headers, "Content-Type": content_type, "x-upsert": "false"},
            content=data,
            timeout=60,
        )
        if r.status_code not in (200, 201):
            raise ApiError(502, "storage_error", "Could not store the file")

    def get(self, path: str) -> bytes:
        r = httpx.get(f"{self.base}/{path}", headers=self.headers, timeout=60)
        if r.status_code != 200:
            raise ApiError(404, "not_found", "File not found")
        return r.content

    def delete(self, path: str) -> None:
        httpx.request("DELETE", f"{self.base}/{path}", headers=self.headers, timeout=30)


class LocalStorage:
    def __init__(self, root: str | None = None) -> None:
        s = get_settings()
        if s.env == "production":
            raise RuntimeError("Local file storage is not allowed in production")
        self.root = Path(root or s.local_storage_dir).resolve()

    def _path(self, path: str) -> Path:
        full = (self.root / path).resolve()
        if self.root not in full.parents:
            raise ApiError(400, "bad_request", "Invalid storage path")
        return full

    def put(self, path: str, data: bytes, content_type: str) -> None:
        full = self._path(path)
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_bytes(data)

    def get(self, path: str) -> bytes:
        full = self._path(path)
        if not full.is_file():
            raise ApiError(404, "not_found", "File not found")
        return full.read_bytes()

    def delete(self, path: str) -> None:
        self._path(path).unlink(missing_ok=True)


_override: Storage | None = None


def set_storage(storage: Storage | None) -> None:
    """Tests use this to point storage at a temporary folder."""
    global _override
    _override = storage


def get_storage() -> Storage:
    if _override is not None:
        return _override
    s = get_settings()
    if s.supabase_url and s.supabase_service_role_key:
        return SupabaseStorage()
    if s.env in ("development", "test"):
        return LocalStorage()
    raise ApiError(503, "storage_not_configured", "File storage is not configured")
