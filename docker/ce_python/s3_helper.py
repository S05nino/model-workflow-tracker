"""
S3 Helper for TEST_SUITE data.

Provides functions to:
- List countries/segments/files from S3
- Download files needed for a test run to local cache
- Upload output files back to S3 after tests
"""

import os
import boto3
from typing import List, Optional, Dict
from pathlib import PurePosixPath

S3_BUCKET = os.environ.get("S3_BUCKET", "cateng")
S3_PREFIX = os.environ.get("S3_PREFIX", "TEST_SUITE/")
LOCAL_CACHE = os.environ.get("TEST_SUITE_DATA_PATH", "/data/TEST_SUITE")

_s3 = None


def get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client(
            "s3",
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
            region_name=os.environ.get("AWS_REGION", "eu-west-1"),
        )
    return _s3


def _list_common_prefixes(prefix: str) -> List[str]:
    """List 'subdirectories' under a given S3 prefix."""
    s3 = get_s3()
    result = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix, Delimiter="/"):
        for cp in page.get("CommonPrefixes", []):
            # Extract folder name from prefix
            name = cp["Prefix"][len(prefix):].rstrip("/")
            if name:
                result.append(name)
    return sorted(result)


def _list_files(prefix: str, suffix: Optional[str] = None) -> List[str]:
    """List files (keys) under a prefix, optionally filtered by suffix."""
    s3 = get_s3()
    result = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix, Delimiter="/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            name = key[len(prefix):]
            if name and "/" not in name:  # only direct children
                if suffix is None or name.endswith(suffix):
                    result.append(name)
    return sorted(result)


def list_countries() -> List[str]:
    """List country folders in S3."""
    return _list_common_prefixes(S3_PREFIX)


def list_segments(country: str) -> List[str]:
    """List segment folders for a country."""
    prefix = f"{S3_PREFIX}{country}/"
    return _list_common_prefixes(prefix)


def find_latest_date_folder(country: str, segment: str) -> Optional[str]:
    """Find the latest date folder that contains a 'model/' subfolder."""
    prefix = f"{S3_PREFIX}{country}/{segment}/"
    folders = _list_common_prefixes(prefix)
    # Filter to those that have a model/ subfolder
    date_folders = []
    for f in folders:
        # Check if model/ exists under this folder
        model_prefix = f"{prefix}{f}/model/"
        s3 = get_s3()
        resp = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=model_prefix, MaxKeys=1)
        if resp.get("KeyCount", 0) > 0:
            date_folders.append(f)
    if date_folders:
        date_folders.sort(reverse=True)
        return date_folders[0]
    return None


def list_files_for_segment(country: str, segment: str, date_folder: str) -> Dict:
    """List all relevant files for a country/segment/date_folder."""
    base = f"{S3_PREFIX}{country}/{segment}/{date_folder}/"
    
    result = {
        "sample_files": [],
        "prod_models": [],
        "dev_models": [],
        "expert_rules_old": [],
        "expert_rules_new": [],
        "tagger_models": [],
        "company_lists": [],
        "date_folder": date_folder,
        "segment_folder": segment,
    }
    
    # Sample files
    sample_prefix = f"{base}sample/"
    all_samples = _list_files(sample_prefix)
    result["sample_files"] = [f for f in all_samples if f.endswith((".tsv.gz", ".tsv"))]
    result["company_lists"] = [f for f in all_samples if f.endswith(".xlsx") and "compan" in f.lower()]
    
    model_prefix = f"{base}model/"
    
    if segment.lower() in ("consumer", "business"):
        result["prod_models"] = _list_files(f"{model_prefix}prod/", ".zip")
        result["dev_models"] = _list_files(f"{model_prefix}develop/", ".zip")
        
        # Expert rules - check old/new subfolders
        old_rules = _list_files(f"{model_prefix}expertrules/old/", ".zip")
        new_rules = _list_files(f"{model_prefix}expertrules/new/", ".zip")
        if old_rules or new_rules:
            result["expert_rules_old"] = old_rules
            result["expert_rules_new"] = new_rules
        else:
            # Flat structure
            all_rules = _list_files(f"{model_prefix}expertrules/", ".zip")
            result["expert_rules_old"] = all_rules
            result["expert_rules_new"] = all_rules
    
    elif segment.lower() == "tagger":
        result["tagger_models"] = _list_files(model_prefix, ".zip")
    
    return result


def download_file(s3_key: str, local_path: str):
    """Download a single file from S3 to local path."""
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    if os.path.exists(local_path):
        # Skip if already cached
        return
    print(f"[S3] Downloading s3://{S3_BUCKET}/{s3_key} -> {local_path}")
    get_s3().download_file(S3_BUCKET, s3_key, local_path)


def download_prefix(s3_prefix: str, local_dir: str):
    """Download all files under an S3 prefix to a local directory."""
    s3 = get_s3()
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=s3_prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            relative = key[len(s3_prefix):]
            if not relative:
                continue
            local_path = os.path.join(local_dir, relative)
            download_file(key, local_path)


def download_test_data(country: str, segment: str, date_folder: str,
                       files_to_download: List[str] = None):
    """Download all data needed for a test run.
    
    Downloads: sample files, models, expert rules to local cache.
    The TestRunner library expects local filesystem paths.
    """
    base_s3 = f"{S3_PREFIX}{country}/{segment}/{date_folder}/"
    base_local = os.path.join(LOCAL_CACHE, country, segment, date_folder)
    
    # Download sample folder
    download_prefix(f"{base_s3}sample/", os.path.join(base_local, "sample"))
    
    # Download model folder (all subfolders: prod, develop, expertrules)
    download_prefix(f"{base_s3}model/", os.path.join(base_local, "model"))
    
    # Create output folder
    os.makedirs(os.path.join(base_local, "output"), exist_ok=True)
    
    print(f"[S3] Test data downloaded to {base_local}")
    return base_local


def upload_outputs(country: str, segment: str, date_folder: str, output_local: str):
    """Upload the output folder back to S3."""
    s3 = get_s3()
    base_s3 = f"{S3_PREFIX}{country}/{segment}/{date_folder}/output/"
    
    for root, dirs, files in os.walk(output_local):
        for f in files:
            local_path = os.path.join(root, f)
            relative = os.path.relpath(local_path, output_local)
            s3_key = base_s3 + relative.replace("\\", "/")
            print(f"[S3] Uploading {local_path} -> s3://{S3_BUCKET}/{s3_key}")
            s3.upload_file(local_path, S3_BUCKET, s3_key)
    
    print(f"[S3] Outputs uploaded to s3://{S3_BUCKET}/{base_s3}")
