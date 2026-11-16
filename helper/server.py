from __future__ import annotations

import asyncio
import contextlib
import http.server
import io
import json
import os
from pathlib import Path
import select
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import wave
import re
from urllib.parse import urlsplit
from collections.abc import Callable
from functools import partial
from typing import Any

MAX_BODY_BYTES = 1_000_000
MAX_SAMPLE_SECONDS = 20
ANALYSIS_SECONDS = 12
RECOGNITION_TIMEOUT_SECONDS = 45
WORKER_TIMEOUT_SECONDS = 40
SONGREC_TIMEOUT_SECONDS = 12
SHAZAMIO_PATH = "/recognize"
SONGREC_PATH = "/recognize/songrec"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 18742
DEFAULT_EXTENSION_ORIGIN = "chrome-extension://oeamoddpghhjhhakjimcelbhjpjfboba"
EXTENSION_ORIGINS_ENV = "ASF_EXTENSION_ORIGINS"
LEGACY_EXTENSION_ORIGIN_ENV = "ASF_EXTENSION_ORIGIN"
MARKER_HEADER = "X-Anime-Song-Finder"


def validate_extension_origin(origin: str) -> str:
    """Accept only serialized origins for supported browser extension schemes."""
    if not isinstance(origin, str) or not origin or origin != origin.strip() or any(ch.isspace() for ch in origin):
        raise ValueError(f"Invalid extension origin: {origin!r}")
    try:
        parsed = urlsplit(origin)
        # Accessing port also rejects malformed port syntax; ports are never allowed here.
        port = parsed.port
    except ValueError as exc:
        raise ValueError(f"Invalid extension origin: {origin!r}") from exc
    host = parsed.hostname or ""
    valid_host = bool(re.fullmatch(r"[a-p]{32}", host)) if parsed.scheme in {"chrome-extension", "edge-extension"} else bool(
        re.fullmatch(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", host)
    ) if parsed.scheme in {"moz-extension", "safari-web-extension"} else False
    serialized_host_matches = (
        parsed.netloc.casefold() == host
        if parsed.scheme in {"moz-extension", "safari-web-extension"}
        else parsed.netloc == host
    )
    if (not valid_host or parsed.username is not None or parsed.password is not None or port is not None
            or parsed.path or parsed.query or parsed.fragment or not serialized_host_matches):
        raise ValueError(f"Invalid extension origin: {origin!r}")
    return origin


def configured_extension_origins() -> tuple[str, ...]:
    """Read and validate the current process origin allowlist."""
    configured = os.environ.get(EXTENSION_ORIGINS_ENV)
    legacy = os.environ.get(LEGACY_EXTENSION_ORIGIN_ENV)
    values: list[str] = []
    if configured is not None:
        values.extend(configured.split(","))
    if legacy is not None:
        values.append(legacy)
    if not values:
        values.append(DEFAULT_EXTENSION_ORIGIN)
    origins = tuple(dict.fromkeys(validate_extension_origin(value.strip()) for value in values))
    if not origins:
        raise ValueError("At least one extension origin must be configured.")
    return origins


class RequestError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


class RecognitionService:
    """In-memory guard rails for a single-user localhost helper."""

    def __init__(self, recognizer: Callable[[bytes], list[dict[str, str]]] | None = None) -> None:
        self._recognizer = recognizer
        self._worker = BrowserRecognitionWorker()
        self._recognition_guard = threading.Lock()

    def recognize(self, wav_bytes: bytes, disconnected: Callable[[], bool] | None = None, *, songrec: bool = False) -> list[dict[str, str]]:
        normalized = normalize_wav(wav_bytes)
        if not self._recognition_guard.acquire(blocking=False):
            raise RequestError(429, "A recognition is already running.")
        try:
            started = time.monotonic()
            if disconnected and disconnected():
                raise RequestError(499, "Recognition cancelled.")
            runner = partial(self._worker.run, disconnected=disconnected)
            if songrec:
                songs = recognize_with_songrec(normalized, runner)
            elif self._recognizer:
                songs = self._recognizer(normalized)
            else:
                songs = recognize_in_subprocess(normalized, runner)
            if time.monotonic() - started > RECOGNITION_TIMEOUT_SECONDS:
                raise RequestError(504, "Recognition timed out. Try again with a clearer music sample.")
            return songs
        except RequestError:
            raise
        except TimeoutError as exc:
            raise RequestError(504, "Recognition timed out. Try again with a clearer music sample.") from exc
        except Exception as exc:
            raise RequestError(502, "The recognition service did not return a usable result.") from exc
        finally:
            self._recognition_guard.release()

    def close(self) -> None:
        self._worker.close()


def normalize_wav(raw: bytes) -> bytes:
    if len(raw) > MAX_BODY_BYTES:
        raise RequestError(413, "Audio sample exceeds the 1 MB limit.")
    if len(raw) < 44 or raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
        raise RequestError(400, "Send a valid RIFF/WAVE audio sample.")
    try:
        with wave.open(io.BytesIO(raw), "rb") as reader:
            params = reader.getparams()
            if params.comptype != "NONE" or params.sampwidth != 2 or params.nchannels != 1:
                raise RequestError(400, "Audio must be uncompressed mono 16-bit PCM WAV.")
            if params.framerate <= 0 or params.nframes <= 0:
                raise RequestError(400, "Audio sample has no playable frames.")
            if params.nframes > params.framerate * MAX_SAMPLE_SECONDS:
                raise RequestError(400, "Audio sample must be 20 seconds or shorter.")
            frame_count = params.nframes
            read_count = min(frame_count, params.framerate * ANALYSIS_SECONDS)
            start_frame = max(0, (frame_count - read_count) // 2)
            reader.setpos(start_frame)
            frames = reader.readframes(read_count)
            if len(frames) != read_count * params.sampwidth:
                raise RequestError(400, "Audio sample is incomplete.")
    except RequestError:
        raise
    except (wave.Error, EOFError, OSError) as exc:
        raise RequestError(400, "Send a valid RIFF/WAVE audio sample.") from exc

    cropped = io.BytesIO()
    with wave.open(cropped, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(params.framerate)
        writer.writeframes(frames)
    return cropped.getvalue()


def normalize_result(payload: Any) -> list[dict[str, str]]:
    if not isinstance(payload, dict):
        raise RequestError(502, "The recognition service returned an invalid response.")
    track = payload.get("track")
    matches = payload.get("matches")
    if isinstance(track, dict):
        title = track.get("title")
        artist = track.get("subtitle") or track.get("artist")
        if not isinstance(title, str) or not title.strip() or not isinstance(artist, str) or not artist.strip():
            if matches == []:
                return []
            raise RequestError(502, "The recognition service returned an invalid track response.")
    elif matches == []:
        return []
    else:
        raise RequestError(502, "The recognition service returned an invalid response.")
    song = {"title": title.strip(), "artist": artist.strip()}
    album = track.get("album")
    if not isinstance(album, str):
        album = None
        sections = track.get("sections")
        for section in (sections if isinstance(sections, list) else []):
            if not isinstance(section, dict) or not isinstance(section.get("metadata"), list):
                continue
            for item in section["metadata"]:
                if isinstance(item, dict) and isinstance(item.get("title"), str) and item["title"].strip().lower() == "album":
                    text = item.get("text")
                    if isinstance(text, str) and text.strip():
                        album = text.strip()
                        break
            if album:
                break
    if isinstance(album, str) and album.strip():
        song["album"] = album.strip()
    return [song]


def recognize_with_shazamio(wav_bytes: bytes) -> list[dict[str, str]]:
    from shazamio import Shazam

    async def identify() -> Any:
        async with Shazam() as shazam:
            return await asyncio.wait_for(
                shazam.recognize(wav_bytes), timeout=RECOGNITION_TIMEOUT_SECONDS
            )

    try:
        payload = asyncio.run(identify())
    except TimeoutError as exc:
        raise RequestError(504, "Recognition timed out. Try again with a clearer music sample.") from exc
    return normalize_result(payload)


def songrec_executable() -> Path:
    bundled = Path(__file__).resolve().parent.parent / "local-data" / "songrec" / "songrec.exe"
    if os.name == "nt" and bundled.is_file():
        return bundled
    on_path = shutil.which("songrec")
    if on_path:
        return Path(on_path).resolve()
    setup = "Run scripts/setup-songrec.ps1 and try again." if os.name == "nt" else "Install SongRec and make it available on the helper's PATH."
    raise RequestError(503, f"SongRec is not installed. {setup}")


def recognize_with_songrec(wav_bytes: bytes, runner) -> list[dict[str, str]]:
    executable = songrec_executable()
    # SongRec's file CLI needs a WAV path. Keep the sample alive only until
    # the shared worker has exited, including on timeout or cancellation.
    with tempfile.TemporaryDirectory(prefix="anioto-songrec-") as directory:
        sample = Path(directory) / "sample.wav"
        sample.write_bytes(wav_bytes)
        try:
            completed = runner(
                [str(executable), "audio-file-to-recognized-song", str(sample)],
                input=b"", stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                timeout=SONGREC_TIMEOUT_SECONDS, check=False, cwd=executable.parent,
            )
        except subprocess.TimeoutExpired as exc:
            raise RequestError(504, "SongRec recognition timed out. Try again with a clearer sample.") from exc
        except OSError as exc:
            raise RequestError(502, "SongRec could not start. Check your SongRec installation.") from exc
    if completed.returncode != 0:
        raise RequestError(502, "SongRec recognition failed. Check your connection or try ShazamIO in Settings.")
    try:
        payload = json.loads(completed.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RequestError(502, "SongRec returned an invalid response.") from exc
    return normalize_result(payload)


def recognize_in_subprocess(wav_bytes: bytes, runner=None) -> list[dict[str, str]]:
    command = [sys.executable, os.path.abspath(__file__), "--recognize-worker"]
    try:
        completed = (runner or subprocess.run)(
            command,
            input=wav_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=WORKER_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise RequestError(504, "Recognition timed out. Try again with a clearer music sample.") from exc
    except OSError as exc:
        raise RequestError(502, "The local recognition worker could not start.") from exc

    try:
        payload = json.loads(completed.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RequestError(502, "The local recognition worker returned an invalid response.") from exc
    if not isinstance(payload, dict):
        raise RequestError(502, "The local recognition worker returned an invalid response.")
    if completed.returncode != 0 or payload.get("ok") is not True:
        # Never pass captured stderr or arbitrary child exception text to the browser.
        raise RequestError(502, "The recognition worker failed. Try again later.")
    songs = payload.get("songs")
    if not isinstance(songs, list):
        raise RequestError(502, "The local recognition worker returned an invalid song list.")
    normalized: list[dict[str, str]] = []
    for song in songs:
        if not isinstance(song, dict):
            raise RequestError(502, "The local recognition worker returned an invalid song list.")
        title, artist, album = song.get("title"), song.get("artist"), song.get("album")
        if not isinstance(title, str) or not title.strip() or not isinstance(artist, str) or not artist.strip():
            raise RequestError(502, "The local recognition worker returned an invalid song list.")
        if album is not None and not isinstance(album, str):
            raise RequestError(502, "The local recognition worker returned an invalid song list.")
        normalized.append({
            "title": title.strip(),
            "artist": artist.strip(),
            **({"album": album.strip()} if isinstance(album, str) and album.strip() else {}),
        })
    return normalized


def run_recognition_worker() -> int:
    try:
        audio = sys.stdin.buffer.read(MAX_BODY_BYTES + 1)
        if not audio or len(audio) > MAX_BODY_BYTES:
            raise RequestError(400, "Audio sample is invalid.")
        with contextlib.redirect_stdout(io.StringIO()):
            songs = recognize_with_shazamio(audio)
        response = {"ok": True, "songs": songs}
        status = 0
    except RequestError as exc:
        response = {"ok": False, "error": exc.message}
        status = 1
    except Exception:
        response = {"ok": False, "error": "The recognition worker failed."}
        status = 1
    sys.stdout.write(json.dumps(response, ensure_ascii=True, separators=(",", ":")))
    sys.stdout.flush()
    return status


def make_handler(service: RecognitionService, allowed_origin: str | tuple[str, ...], expected_host: str):
    allowed_origins = (allowed_origin,) if isinstance(allowed_origin, str) else tuple(allowed_origin)

    class Handler(http.server.BaseHTTPRequestHandler):
        server_version = "AnimeSongHelper/1"
        sys_version = ""

        def log_message(self, _format: str, *_args: Any) -> None:
            # Never log request headers, user audio, provider results, or exception text.
            return

        def _valid_host(self) -> bool:
            return self.headers.get("Host", "") == expected_host

        def _origin_ok(self, *, required: bool) -> bool:
            origin = self.headers.get("Origin")
            return origin in allowed_origins if required or origin is not None else True

        def _client_disconnected(self) -> bool:
            try:
                readable, _, _ = select.select([self.connection], [], [], 0)
                return bool(readable) and not self.connection.recv(1, socket.MSG_PEEK)
            except OSError:
                return True

        def _send_json(self, status: int, body: dict[str, Any], *, cors: bool = False) -> None:
            encoded = json.dumps(body, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            if cors:
                self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", ""))
                self.send_header("Vary", "Origin")
            self.end_headers()
            self.wfile.write(encoded)

        def do_GET(self) -> None:
            if not self._valid_host():
                self._send_json(403, {"error": "Host is not allowed."})
                return
            if self.path != "/health":
                self._send_json(404, {"error": "Not found."})
                return
            if not self._origin_ok(required=False):
                self._send_json(403, {"error": "Origin is not allowed."})
                return
            origin = self.headers.get("Origin")
            body: dict[str, Any] = {"ok": True, "provider": "shazamio"}
            if origin is None or origin in allowed_origins:
                body["allowedOrigins"] = list(allowed_origins)
            self._send_json(200, body, cors=origin in allowed_origins)

        def do_OPTIONS(self) -> None:
            if not self._valid_host() or not self._origin_ok(required=True) or self.path not in (SHAZAMIO_PATH, SONGREC_PATH):
                self._send_json(403, {"error": "Preflight is not allowed."})
                return
            method = self.headers.get("Access-Control-Request-Method", "").upper()
            requested = {part.strip().lower() for part in self.headers.get("Access-Control-Request-Headers", "").split(",") if part.strip()}
            if method != "POST" or requested != {"content-type", MARKER_HEADER.lower()}:
                self._send_json(403, {"error": "Preflight headers are not allowed."})
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", ""))
            self.send_header("Access-Control-Allow-Methods", "POST")
            self.send_header("Access-Control-Allow-Headers", f"Content-Type, {MARKER_HEADER}")
            self.send_header("Access-Control-Max-Age", "600")
            self.send_header("Vary", "Origin")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_POST(self) -> None:
            if not self._valid_host() or not self._origin_ok(required=True):
                self._send_json(403, {"error": "Request origin or host is not allowed."})
                return
            if self.path not in (SHAZAMIO_PATH, SONGREC_PATH):
                self._send_json(404, {"error": "Not found."}, cors=True)
                return
            if self.headers.get(MARKER_HEADER) != "1":
                self._send_json(403, {"error": "Request marker is required."}, cors=True)
                return
            if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "audio/wav":
                self._send_json(415, {"error": "Content-Type must be audio/wav."}, cors=True)
                return
            transfer_encoding = self.headers.get("Transfer-Encoding")
            if transfer_encoding:
                self._send_json(400, {"error": "Chunked request bodies are not supported."}, cors=True)
                return
            try:
                content_length = int(self.headers.get("Content-Length", ""))
            except ValueError:
                self._send_json(411, {"error": "Content-Length is required."}, cors=True)
                return
            if content_length <= 0:
                self._send_json(400, {"error": "Audio body is required."}, cors=True)
                return
            if content_length > MAX_BODY_BYTES:
                self._send_json(413, {"error": "Audio sample exceeds the 1 MB limit."}, cors=True)
                return
            self.connection.settimeout(15)
            try:
                raw = self.rfile.read(content_length)
            except (socket.timeout, TimeoutError):
                self._send_json(408, {"error": "Audio request body timed out."}, cors=True)
                return
            if len(raw) != content_length:
                self._send_json(400, {"error": "Audio request body is incomplete."}, cors=True)
                return
            try:
                songs = service.recognize(raw, self._client_disconnected, songrec=self.path == SONGREC_PATH)
                status, payload = 200, {"songs": songs}
            except RequestError as exc:
                status, payload = exc.status, {"error": exc.message}
            if not self._client_disconnected():
                with contextlib.suppress(BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                    self._send_json(status, payload, cors=True)

    return Handler


def make_server(
    service: RecognitionService | None = None,
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    allowed_origin: str | None = None,
) -> http.server.ThreadingHTTPServer:
    origins = (validate_extension_origin(allowed_origin),) if allowed_origin is not None else configured_extension_origins()
    expected_host = f"{host}:{port}"
    server = http.server.ThreadingHTTPServer((host, port), make_handler(service or RecognitionService(), origins, expected_host))
    server.daemon_threads = True
    return server


class BrowserRecognitionWorker:
    """Own the worker process while its HTTP request is connected."""

    def __init__(self):
        self.lock = threading.Lock()
        self.process = None
        self.closed = False

    def run(self, command, *, input, stdout, stderr, timeout, check, disconnected=None, cwd=None):
        with self.lock:
            if self.closed:
                raise OSError("The browser session has closed.")
            self.process = process = subprocess.Popen(
                command, stdin=subprocess.PIPE, stdout=stdout, stderr=stderr, cwd=cwd,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
        try:
            with process:
                try:
                    if disconnected is None:
                        output, errors = process.communicate(input, timeout=timeout)
                    else:
                        deadline = time.monotonic() + timeout
                        while True:
                            if disconnected():
                                raise RequestError(499, "Recognition cancelled.")
                            remaining = deadline - time.monotonic()
                            if remaining <= 0:
                                raise subprocess.TimeoutExpired(command, timeout)
                            try:
                                output, errors = process.communicate(input, timeout=min(remaining, 0.15))
                                break
                            except subprocess.TimeoutExpired:
                                input = None
                except BaseException:
                    process.kill()
                    raise
                return subprocess.CompletedProcess(command, process.returncode, output, errors)
        finally:
            with self.lock:
                self.process = None

    def close(self):
        with self.lock:
            self.closed = True
            if self.process is not None:
                self.process.kill()


def serve_browser_managed() -> None:
    # The embedded Windows runtime does not add the script directory to sys.path.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from browser_session import has_browser_session, launch_lock

    service = RecognitionService()
    try:
        with make_server(service) as server:
            server.timeout = 0.5
            last_browser = time.monotonic()
            while True:
                server.handle_request()
                if has_browser_session():
                    last_browser = time.monotonic()
                elif time.monotonic() - last_browser >= 2:
                    with launch_lock():
                        if not has_browser_session(prune=True):
                            server.server_close()
                            return
    finally:
        service.close()


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--recognize-worker":
        raise SystemExit(run_recognition_worker())
    if len(sys.argv) == 2 and sys.argv[1] == "--browser-managed":
        serve_browser_managed()
    else:
        make_server().serve_forever(poll_interval=0.5)
