import base64
import hashlib
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


@dataclass
class EncryptedToken:
    cipher_token: bytes
    token_nonce: bytes
    token_kek_version: str
    token_fingerprint: str


def _get_kek_version() -> str:
    return os.getenv("HUB_TOKEN_KEK_VERSION", "v1").strip() or "v1"


def _get_kek_bytes() -> bytes:
    raw = os.getenv("HUB_TOKEN_KEK", "").strip()
    if not raw:
        raise RuntimeError("HUB_TOKEN_KEK is required.")
    return hashlib.sha256(raw.encode("utf-8")).digest()


def encrypt_token(token: str) -> EncryptedToken:
    nonce = os.urandom(12)
    aesgcm = AESGCM(_get_kek_bytes())
    cipher_token = aesgcm.encrypt(nonce, token.encode("utf-8"), None)
    return EncryptedToken(
        cipher_token=cipher_token,
        token_nonce=nonce,
        token_kek_version=_get_kek_version(),
        token_fingerprint=hashlib.sha256(token.encode("utf-8")).hexdigest(),
    )


def decrypt_token(cipher_token: bytes, token_nonce: bytes) -> str:
    aesgcm = AESGCM(_get_kek_bytes())
    return aesgcm.decrypt(token_nonce, cipher_token, None).decode("utf-8")


def mask_token_from_fingerprint(token: str) -> str:
    value = (token or "").strip()
    if not value:
        return ""
    if len(value) <= 6:
        prefix = value[:1]
        suffix = value[-1:] if len(value) > 1 else ""
        return f"{prefix}{'*' * 10}{suffix}"
    return f"{value[:3]}{'*' * 10}{value[-3:]}"


def encode_runtime_token(token: str) -> str:
    return base64.b64encode(token.encode("utf-8")).decode("ascii")


def decode_runtime_token(encoded: str) -> str:
    return base64.b64decode(encoded.encode("ascii")).decode("utf-8")
