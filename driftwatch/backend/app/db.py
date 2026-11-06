"""Tiny SQLite store for simulation runs (stdlib only)."""
from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    id          TEXT PRIMARY KEY,
    config_hash TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    status      TEXT NOT NULL,
    config      TEXT NOT NULL,
    summary     TEXT,
    result      TEXT,
    error       TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_hash ON runs (config_hash);
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs (created_at DESC);
"""


class RunStore:
    def __init__(self, path: Path | str):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._conn.executescript(SCHEMA)
            # A restart orphans anything that was still running.
            self._conn.execute("UPDATE runs SET status='failed', error='server restarted' "
                               "WHERE status IN ('queued','running')")
            self._conn.commit()

    def insert(self, run_id, config_hash, created_at, config: dict):
        with self._lock:
            self._conn.execute(
                "INSERT INTO runs (id, config_hash, created_at, status, config) VALUES (?,?,?,?,?)",
                (run_id, config_hash, created_at, "queued", json.dumps(config)))
            self._conn.commit()

    def set_status(self, run_id, status, error=None):
        with self._lock:
            self._conn.execute("UPDATE runs SET status=?, error=? WHERE id=?", (status, error, run_id))
            self._conn.commit()

    def finish(self, run_id, summary: dict, result: dict):
        with self._lock:
            self._conn.execute("UPDATE runs SET status='done', summary=?, result=? WHERE id=?",
                               (json.dumps(summary), json.dumps(result), run_id))
            self._conn.commit()

    def get(self, run_id):
        with self._lock:
            row = self._conn.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone()
        return dict(row) if row else None

    def find_by_hash(self, config_hash):
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM runs WHERE config_hash=? AND status IN ('queued','running','done') "
                "ORDER BY created_at DESC LIMIT 1", (config_hash,)).fetchone()
        return dict(row) if row else None

    def list(self, limit=30):
        with self._lock:
            rows = self._conn.execute(
                "SELECT id, created_at, status, config, summary, error FROM runs "
                "ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]

    def delete(self, run_id) -> bool:
        with self._lock:
            cur = self._conn.execute("DELETE FROM runs WHERE id=?", (run_id,))
            self._conn.commit()
        return cur.rowcount > 0
