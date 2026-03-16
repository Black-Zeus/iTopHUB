import os
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


RUNNING = True


def stop_worker(signum, _frame):
    global RUNNING
    RUNNING = False
    print(f"[pdf-worker] stopping on signal {signum}", flush=True)


def main() -> int:
    signal.signal(signal.SIGINT, stop_worker)
    signal.signal(signal.SIGTERM, stop_worker)

    output_dir = Path(os.getenv("PDF_STORAGE_DIR", "/app/output"))
    heartbeat_seconds = int(os.getenv("PDF_WORKER_HEARTBEAT_SECONDS", "300"))
    output_dir.mkdir(parents=True, exist_ok=True)

    print("[pdf-worker] bootstrap activo", flush=True)
    print(f"[pdf-worker] gotenberg_url={os.getenv('GOTENBERG_URL', '')}", flush=True)
    print(f"[pdf-worker] output_dir={output_dir}", flush=True)
    print(f"[pdf-worker] heartbeat_seconds={heartbeat_seconds}", flush=True)

    while RUNNING:
        timestamp = datetime.now(timezone.utc).isoformat()
        print(f"[pdf-worker] heartbeat {timestamp}", flush=True)
        time.sleep(heartbeat_seconds)

    print("[pdf-worker] detenido correctamente", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
