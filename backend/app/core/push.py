"""Envio de Web Push (VAPID) via pywebpush.

Camada fina e substituível: os services só chamam `send(...)`. Em testes, ou sem chaves VAPID
configuradas, nada é enviado. Gere o par de chaves com `python -m app.core.push`.
"""

import base64
import json
import logging
from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from pywebpush import WebPushException, webpush_async

from app.core.config import get_settings

log = logging.getLogger("disciplina.push")

PUSH_TTL_SECONDS = 600  # um alarme com mais de 10 min de atraso não vale a pena entregar


class PushGoneError(Exception):
    """A assinatura não existe mais no navegador (404/410): pode ser apagada."""


def generate_vapid_keys() -> tuple[str, str]:
    """Devolve (chave pública, chave privada) em base64url sem padding, formato esperado pelo
    `PushManager.subscribe` (pública) e pelo pywebpush (privada)."""
    private = ec.generate_private_key(ec.SECP256R1())
    private_raw = private.private_numbers().private_value.to_bytes(32, "big")
    public_raw = private.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()  # noqa: E731
    return b64(public_raw), b64(private_raw)


async def send(subscription_info: dict[str, Any], payload: dict[str, Any]) -> bool:
    """Envia um push. Devolve True se saiu; False se o push está desligado.

    Lança PushGoneError quando a assinatura expirou. Outros erros são registrados e engolidos:
    um push que falha não pode derrubar o job de alarmes.
    """
    s = get_settings()
    if not s.push_enabled:
        return False
    try:
        await webpush_async(
            subscription_info,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=s.vapid_private_key,
            vapid_claims={"sub": s.vapid_subject},
            ttl=PUSH_TTL_SECONDS,
            headers={"Urgency": "high"},
            timeout=10,
        )
    except WebPushException as exc:
        if exc.status_code in (404, 410):
            raise PushGoneError from exc
        log.warning("push falhou (%s): %s", exc.status_code, exc.message)
        return False
    except Exception as exc:  # noqa: BLE001 — rede fora do ar, DNS etc.
        log.warning("push falhou: %s", exc)
        return False
    return True


if __name__ == "__main__":
    public, private = generate_vapid_keys()
    print(f"VAPID_PUBLIC_KEY={public}")
    print(f"VAPID_PRIVATE_KEY={private}")
