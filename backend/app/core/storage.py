"""Supabase Storage (private bucket, signed URLs). Files never go into the database as base64;
only the storage path is stored on the `documents` row. Used from the documents phase onward."""

import httpx

from app.config import get_settings
from app.core.errors import ApiError


class Storage:
    def __init__(self) -> None:
        s = get_settings()
        if not (s.supabase_url and s.supabase_service_role_key):
            raise ApiError(503, "storage_not_configured", "File storage is not configured")
        self.base = f"{s.supabase_url}/storage/v1"
        self.bucket = s.storage_bucket
        self.headers = {"apikey": s.supabase_service_role_key, "Authorization": f"Bearer {s.supabase_service_role_key}"}

    def upload(self, path: str, data: bytes, content_type: str) -> None:
        r = httpx.post(
            f"{self.base}/object/{self.bucket}/{path}",
            headers={**self.headers, "Content-Type": content_type, "x-upsert": "false"},
            content=data,
            timeout=30,
        )
        if r.status_code not in (200, 201):
            raise ApiError(502, "storage_error", "Could not store the file")

    def signed_url(self, path: str, expires_in: int = 300) -> str:
        r = httpx.post(
            f"{self.base}/object/sign/{self.bucket}/{path}",
            headers=self.headers,
            json={"expiresIn": expires_in},
            timeout=10,
        )
        if r.status_code != 200:
            raise ApiError(502, "storage_error", "Could not create a download link")
        return f"{get_settings().supabase_url}/storage/v1{r.json()['signedURL']}"

    def delete(self, path: str) -> None:
        httpx.request(
            "DELETE", f"{self.base}/object/{self.bucket}", headers=self.headers, json={"prefixes": [path]}, timeout=10
        )
