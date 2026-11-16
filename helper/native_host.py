"""One-command Native Messaging bridge tied to the browser connection."""
from __future__ import annotations

import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
HOST_MANIFEST = ROOT / "local-data/native-host/com.otone.helper.json"
MAX_MESSAGE = 4096
sys.path.insert(0, str(Path(__file__).resolve().parent))
from server import validate_extension_origin  # noqa: E402
from browser_session import browser_session, launch_lock  # noqa: E402


def read_exact(stream, size: int) -> bytes:
    data = b""
    while len(data) < size:
        chunk = stream.read(size - len(data))
        if not chunk:
            raise ValueError("Incomplete native message.")
        data += chunk
    return data


def read_message(stream) -> dict:
    size = struct.unpack("<I", read_exact(stream, 4))[0]
    if not 0 < size <= MAX_MESSAGE:
        raise ValueError("Invalid native message size.")
    message = json.loads(read_exact(stream, size).decode("utf-8"))
    if message != {"type": "ensureHelper"}:
        raise ValueError("Only helper startup is supported.")
    return message


def allowed_origins(path: Path = HOST_MANIFEST) -> list[str]:
    config = json.loads(path.read_text(encoding="utf-8-sig"))
    values = config.get("allowed_origins")
    if not isinstance(values, list) or not 1 <= len(values) <= 16:
        raise ValueError("Native helper configuration is invalid.")
    result = []
    for value in values:
        if not isinstance(value, str):
            raise ValueError("Invalid extension origin.")
        origin = validate_extension_origin(value.removesuffix("/"))
        if not origin.startswith("chrome-extension://"):
            raise ValueError("This launcher supports Chromium extension origins only.")
        result.append(origin)
    return list(dict.fromkeys(result))


def authorize(caller: str, origins: list[str]) -> None:
    if caller not in {value for origin in origins for value in (origin, origin + "/")}:
        raise ValueError("This extension is not allowed to start the helper.")


def health():
    # Ignore environment proxy settings for the fixed loopback-only service.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open("http://127.0.0.1:18742/health", timeout=0.8) as response:
            body = json.loads(response.read(16385))
        if isinstance(body, dict) and body.get("ok") is True and body.get("provider") == "shazamio":
            return body
    except (OSError, ValueError):
        pass
    return None


def accepts(body, origins: list[str]) -> bool:
    values = body.get("allowedOrigins")
    return isinstance(values, list) and all(origin in values for origin in origins)


def ensure_helper(origins: list[str]) -> str:
    with launch_lock():
        current = health()
        if current:
            if not accepts(current, origins):
                raise RuntimeError("The running helper does not allow the installed extension. Restart the helper with the configured origins.")
            return "already-running"
        python = ROOT / "local-data/runtime/python.exe"
        server = ROOT / "helper/server.py"
        if not python.is_file() or not server.is_file():
            raise RuntimeError("The local helper runtime is missing. Run setup-helper.ps1 first.")
        env = os.environ.copy()
        env["ASF_EXTENSION_ORIGINS"] = ",".join(origins)
        env.pop("ASF_EXTENSION_ORIGIN", None)
        process = subprocess.Popen(
            [str(python), str(server), "--browser-managed"], cwd=str(ROOT), env=env,
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP,
            close_fds=True,
        )
        (ROOT / "local-data/helper.pid").write_text(str(process.pid), encoding="ascii")
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            current = health()
            if current:
                if not accepts(current, origins):
                    raise RuntimeError("The helper started with an unexpected extension allowlist.")
                return "started"
            if process.poll() is not None:
                raise RuntimeError("The local helper could not start. Check port 18742 and the helper setup.")
            time.sleep(0.2)
        raise RuntimeError("The local helper did not become ready within 10 seconds.")


def respond(output_stream, response: dict) -> None:
    raw = json.dumps(response, separators=(",", ":")).encode("utf-8")
    output_stream.write(struct.pack("<I", len(raw)) + raw)
    output_stream.flush()


def run(input_stream, output_stream, caller: str) -> int:
    try:
        origins = allowed_origins()
        authorize(caller, origins)
        read_message(input_stream)
        with browser_session():
            respond(output_stream, {"ok": True, "status": ensure_helper(origins)})
            # The connection carries a single startup command. EOF releases the session.
            input_stream.read(1)
        return 0
    except (ValueError, RuntimeError) as error:
        response = {"ok": False, "error": str(error)}
    except Exception:
        response = {"ok": False, "error": "The native helper launcher failed. Reinstall the Otone native helper registration."}
    respond(output_stream, response)
    return 1


if __name__ == "__main__":
    raise SystemExit(run(sys.stdin.buffer, sys.stdout.buffer, sys.argv[1] if len(sys.argv) > 1 else ""))
