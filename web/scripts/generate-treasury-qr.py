#!/usr/bin/env python3
"""Generate the donation-address QR committed at web/public/treasury-qr.png.

The address is read from backend/.env (SETI_TREASURY_ADDRESS) so the committed
image and the backend's configured treasury can never drift apart. Regenerate
whenever the address changes:

    python3 web/scripts/generate-treasury-qr.py

Requires: qrcode, pillow (both present in the system python3 on this machine).
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import qrcode
from qrcode.constants import ERROR_CORRECT_M

REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = REPO_ROOT / "backend" / ".env"
OUT_PATH = REPO_ROOT / "web" / "public" / "treasury-qr.png"

ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


def read_treasury_address(env_path: Path) -> str:
    if not env_path.exists():
        sys.exit(f"error: {env_path} not found; cannot read SETI_TREASURY_ADDRESS")
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        if key.strip() != "SETI_TREASURY_ADDRESS":
            continue
        # Strip optional surrounding quotes; dotenv allows both.
        address = value.strip().strip("'\"")
        if not ADDRESS_RE.match(address):
            sys.exit(f"error: SETI_TREASURY_ADDRESS is not a 20-byte hex address: {address!r}")
        return address
    sys.exit("error: SETI_TREASURY_ADDRESS not found in " + str(env_path))


def main() -> None:
    address = read_treasury_address(ENV_PATH)

    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(address)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT_PATH, optimize=True)
    print(f"wrote {os.path.relpath(OUT_PATH, REPO_ROOT)} ({image.width}x{image.height}) for {address}")


if __name__ == "__main__":
    main()