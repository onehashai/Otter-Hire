from __future__ import annotations

from pathlib import Path

from app.core.config import settings


class StorageService:
    def __init__(self) -> None:
        self.is_production = settings.is_production
        self.use_s3 = settings.s3_enabled
        self.local_root = Path(settings.local_storage_root).resolve()
        if not self.use_s3:
            self.local_root.mkdir(parents=True, exist_ok=True)
            self.s3_client = None
            self.bucket = None
            self.s3_prefix = ""
            return

        import boto3

        if not settings.aws_s3_bucket or not settings.aws_s3_region:
            raise ValueError("S3 config missing: AWS_S3_BUCKET / AWS_S3_REGION")
        self.bucket = settings.aws_s3_bucket
        self.s3_prefix = settings.s3_root_prefix
        self.s3_client = boto3.client(
            "s3",
            region_name=settings.aws_s3_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )

    def _safe_local_path(self, object_key: str) -> Path:
        path = (self.local_root / object_key.lstrip("/")).resolve()
        if not str(path).startswith(str(self.local_root)):
            raise ValueError("Invalid object key")
        return path

    def _s3_key(self, object_key: str) -> str:
        return f"{self.s3_prefix}/{object_key.lstrip('/')}"

    async def write_bytes(self, object_key: str, content: bytes, content_type: str) -> str:
        if self.use_s3:
            s3_key = self._s3_key(object_key)
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=s3_key,
                Body=content,
                ContentType=content_type,
            )
            return object_key

        path = self._safe_local_path(object_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return object_key

    async def delete_object(self, object_key: str) -> None:
        if self.use_s3:
            self.s3_client.delete_object(Bucket=self.bucket, Key=self._s3_key(object_key))
            return
        path = self._safe_local_path(object_key)
        if path.exists():
            path.unlink()

    async def resolve_url(self, object_key: str) -> str:
        return f"/api/files/local/{object_key.lstrip('/')}"

    async def delete_by_url(self, url: str) -> None:
        clean = (url or "").strip()
        if not clean:
            return
        if clean.startswith("/api/files/local/"):
            object_key = clean[len("/api/files/local/") :]
            await self.delete_object(object_key)
            return
        if clean.startswith("/files/local/"):
            object_key = clean[len("/files/local/") :]
            await self.delete_object(object_key)
            return
        if self.use_s3 and ".amazonaws.com/" in clean:
            object_key = clean.split(".amazonaws.com/", 1)[1]
            if object_key.startswith(f"{self.s3_prefix}/"):
                object_key = object_key[len(self.s3_prefix) + 1 :]
            await self.delete_object(object_key)


storage_service = StorageService()
