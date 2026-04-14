from minio import Minio
import os

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "mockmate")
MINIO_SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "password")

minio_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False
)

def ensure_bucket(bucket_name):
    if not minio_client.bucket_exists(bucket_name):
        minio_client.make_bucket(bucket_name)

# Initialize buckets
try:
    ensure_bucket("resumes")
    ensure_bucket("videos")
except Exception as e:
    print(f"MinIO connection error: {e}")
