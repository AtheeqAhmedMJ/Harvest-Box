"""
services/storage.py
AWS S3 helpers — download images, upload PDFs.

Credentials are passed explicitly to boto3.client() so they always work
whether the service runs locally, in Docker, or on a server without an
IAM role. boto3's default credential chain (env vars, ~/.aws, IMDSv2, etc.)
is bypassed to prevent "Unable to locate credentials" errors when the process
environment doesn't propagate .env values into boto3's own lookup.
"""

import boto3
from botocore.exceptions import ClientError
from urllib.parse import urlparse

from config.settings import settings
from utils.logger import logger

_s3 = None


def _get_client():
    global _s3
    if _s3 is None:
        kwargs = {"region_name": settings.AWS_REGION}
        # Only pass explicit credentials if they are actually set —
        # on EC2/ECS with an IAM role they will be empty and we should
        # let boto3 use the instance profile instead.
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            kwargs["aws_access_key_id"]     = settings.AWS_ACCESS_KEY_ID
            kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
        _s3 = boto3.client("s3", **kwargs)
    return _s3


def _extract_key(url: str) -> str:
    """
    Extract the S3 object key from any S3 URL format.

    Supported formats:
      virtual-hosted: https://bucket.s3.region.amazonaws.com/key/path
      virtual-hosted: https://bucket.s3.amazonaws.com/key/path
      path-style:     https://s3.amazonaws.com/bucket/key/path
      path-style:     https://s3.region.amazonaws.com/bucket/key/path
    """
    parsed = urlparse(url)
    host   = parsed.hostname or ""
    path   = parsed.path.lstrip("/")

    # Virtual-hosted style: bucket name is the first subdomain
    if host.endswith(".amazonaws.com") and not host.startswith("s3"):
        # hostname = bucket.s3[.region].amazonaws.com → key is the full path
        return path

    # Path-style: first path segment is the bucket name
    parts = path.split("/", 1)
    if len(parts) == 2 and parts[0] == settings.S3_BUCKET:
        return parts[1]

    # Old bucket name in path-style (project rename: harvest-box-storage → harvest-box-bucket etc.)
    if len(parts) == 2:
        return parts[1]   # strip whatever the bucket segment is, return the key

    return path  # fallback


def download_image(url: str) -> bytes:
    """Download a private S3 object by URL and return raw bytes."""
    key = _extract_key(url)
    logger.info(f"Downloading s3://{settings.S3_BUCKET}/{key}")
    try:
        obj = _get_client().get_object(Bucket=settings.S3_BUCKET, Key=key)
        return obj["Body"].read()
    except ClientError as e:
        code = e.response["Error"]["Code"]
        logger.error(f"S3 download failed [{code}] for key={key}: {e}")
        raise


def upload_pdf(local_path: str, key: str) -> str:
    """Upload a local PDF to S3 and return its public URL."""
    logger.info(f"Uploading PDF -> s3://{settings.S3_BUCKET}/{key}")
    try:
        _get_client().upload_file(
            local_path,
            settings.S3_BUCKET,
            key,
            ExtraArgs={"ContentType": "application/pdf"},
        )
    except ClientError as e:
        logger.error(f"S3 upload failed: {e}")
        raise
    return f"https://{settings.S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
