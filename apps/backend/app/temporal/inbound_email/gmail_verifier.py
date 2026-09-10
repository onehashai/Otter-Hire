import re

import boto3

from app.core.config import settings

s3 = boto3.client(
    "s3",
    region_name=settings.aws_s3_region,
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
    endpoint_url=settings.s3_endpoint_url
)
resp = s3.list_objects_v2(
    Bucket=settings.aws_s3_bucket,
    Prefix="otter-hire-stag/ses-inbound/raw/"
)
contents = sorted(resp.get("Contents", []), key=lambda x: x.get("LastModified"), reverse=True)
for item in contents:
    k = item.get("Key")
    obj = s3.get_object(Bucket=settings.aws_s3_bucket, Key=k)
    body = obj["Body"].read().decode("utf-8", errors="ignore")
    if "confirmation code" in body.lower() or "google.com/mail/vf-" in body.lower():
        url_match = re.search(r"https://[^\s<>#\"]*google\.com/mail/vf-[^\s<>#\"]*", body)
        code_match = re.search(r"confirmation code:?\s*([0-9]+)", body, re.IGNORECASE)
        if url_match:
            print("VERIFICATION_URL:", url_match.group(0))
        if code_match:
            print("CONFIRMATION_CODE:", code_match.group(1))
        break
