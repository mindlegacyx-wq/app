"""Tipos Pydantic compartilhados."""

from decimal import Decimal
from typing import Annotated

from pydantic import PlainSerializer

# Decimal no banco (exatidão), número no JSON (facilidade no app). Notas têm 2 casas.
Num = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]
