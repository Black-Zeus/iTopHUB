import os
import signal
import sys
import time
from datetime import datetime, timezone


RUNNING = True


def stop_worker(signum, _frame):
    global RUNNING
    RUNNING = False
    print(f"[worker] stopping on signal {signum}", flush=True)


def main() -> int:
    signal.signal(signal.SIGINT, stop_worker)
    signal.signal(signal.SIGTERM, stop_worker)

    redis_host = os.getenv("REDIS_HOST", "redis")
    backend_url = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
    heartbeat_seconds = int(os.getenv("WORKER_HEARTBEAT_SECONDS", "300"))
    print("[worker] bootstrap activo", flush=True)
    print(f"[worker] redis_host={redis_host}", flush=True)
    print(f"[worker] backend_url={backend_url}", flush=True)
    print(f"[worker] heartbeat_seconds={heartbeat_seconds}", flush=True)

    while RUNNING:
        timestamp = datetime.now(timezone.utc).isoformat()
        print(f"[worker] heartbeat {timestamp}", flush=True)
        time.sleep(heartbeat_seconds)

    print("[worker] detenido correctamente", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
