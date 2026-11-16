"""Windows file locks record which browsers still have Otone open."""
from __future__ import annotations

import contextlib
from pathlib import Path
import time
import uuid

HOST_DIR = Path(__file__).resolve().parent.parent / "local-data/native-host"


@contextlib.contextmanager
def launch_lock():
    import msvcrt
    with (HOST_DIR / "launch.lock").open("a+b") as handle:
        deadline = time.monotonic() + 12
        while True:
            try:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                break
            except OSError:
                if time.monotonic() >= deadline:
                    raise RuntimeError("The helper is already starting. Reopen Otone in a moment.")
                time.sleep(0.1)
        try:
            yield
        finally:
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)


@contextlib.contextmanager
def browser_session():
    import msvcrt
    directory = HOST_DIR / "sessions"
    path = directory / f"{uuid.uuid4().hex}.lease"
    with launch_lock():
        directory.mkdir(exist_ok=True)
        handle = path.open("x+b")
        try:
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            handle.close()
            path.unlink(missing_ok=True)
            raise
    try:
        yield
    finally:
        handle.close()
        try:
            path.unlink(missing_ok=True)
        except PermissionError:
            pass  # The helper will remove the unlocked file on its next scan.


def has_browser_session(*, prune: bool = False) -> bool:
    import msvcrt
    for path in (HOST_DIR / "sessions").glob("*.lease"):
        try:
            with path.open("r+b") as handle:
                try:
                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                except OSError:
                    return True
            if prune:
                path.unlink(missing_ok=True)
        except FileNotFoundError:
            continue
        except PermissionError:
            return True
    return False
