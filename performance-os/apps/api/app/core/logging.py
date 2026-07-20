"""Structured logging that never emits private health values in plain text.

Sensitive keys are redacted before a record is formatted. Health *values* (weights,
lab numbers, medications) must be passed via `extra={"sensitive": {...}}` which is dropped.
"""
from __future__ import annotations

import logging
import sys

_SENSITIVE_KEYS = {
    "medication",
    "medications",
    "lab_value",
    "value",
    "weight_kg",
    "body_fat_pct",
    "password",
    "token",
    "access_token",
    "note",
    "notes",
    "journal",
}


class RedactFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if hasattr(record, "sensitive"):
            record.sensitive = "[REDACTED]"
        # Redact known sensitive attributes attached to the record.
        for key in list(vars(record)):
            if key.lower() in _SENSITIVE_KEYS:
                setattr(record, key, "[REDACTED]")
        return True


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RedactFilter())
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)


logger = logging.getLogger("performance_os")
