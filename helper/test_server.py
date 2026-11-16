from __future__ import annotations

import http.client
import io
import json
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import unittest
import wave
from unittest.mock import patch

from server import (
    DEFAULT_EXTENSION_ORIGIN,
    RecognitionService,
    RequestError,
    configured_extension_origins,
    make_handler,
    normalize_result,
    normalize_wav,
    recognize_in_subprocess,
    recognize_with_songrec,
)
from http.server import ThreadingHTTPServer


def wav_sample(seconds: int = 1, sample_rate: int = 8_000) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(sample_rate)
        writer.writeframes(b"\0\0" * (sample_rate * seconds))
    return output.getvalue()


class NormalizationTests(unittest.TestCase):
    def test_full_quality_32khz_capture_fits_upload_limit_and_preserves_rate(self) -> None:
        for seconds in (12, 15):
            original = wav_sample(seconds, 32_000)
            self.assertLessEqual(len(original), 1_000_000)
            normalized = normalize_wav(original)
            with wave.open(io.BytesIO(normalized), 'rb') as reader:
                self.assertEqual(reader.getframerate(), 32_000)
                self.assertEqual(reader.getnframes(), 32_000 * 12)
                self.assertEqual(reader.getsampwidth(), 2)
                self.assertEqual(reader.getnchannels(), 1)

    def test_extracts_song_artist_album_from_shazam_shape(self) -> None:
        self.assertEqual(
            normalize_result({"track": {"title": "  Song  ", "subtitle": " Artist ", "sections": [
                {"metadata": [{"title": "Album", "text": " Release "}]}
            ]}}),
            [{"title": "Song", "artist": "Artist", "album": "Release"}],
        )

    def test_valid_track_is_kept_even_if_matches_metadata_is_nonempty(self) -> None:
        self.assertEqual(
            normalize_result({"track": {"title": "Song", "artist": "Artist"}, "matches": [{"id": "other"}]}),
            [{"title": "Song", "artist": "Artist"}],
        )

    def test_missing_track_is_a_real_no_match(self) -> None:
        self.assertEqual(normalize_result({"matches": []}), [])
        self.assertEqual(normalize_result({"track": {"title": "No artist"}, "matches": []}), [])

    def test_malformed_provider_responses_are_not_reported_as_no_match(self) -> None:
        for payload in ({}, {"matches": None}, {"track": {"title": "Track"}}):
            with self.subTest(payload=payload), self.assertRaisesRegex(RequestError, "invalid response|invalid track"):
                normalize_result(payload)

    def test_accepts_wav_and_crops_analysis_to_twelve_seconds(self) -> None:
        cropped = normalize_wav(wav_sample(18))
        with wave.open(io.BytesIO(cropped), "rb") as reader:
            self.assertEqual(reader.getnframes(), 8_000 * 12)
            self.assertEqual(reader.getframerate(), 8_000)
            self.assertEqual(reader.getsampwidth(), 2)

    def test_rejects_non_wav_and_overlong_audio(self) -> None:
        with self.assertRaisesRegex(RequestError, "RIFF/WAVE"):
            normalize_wav(b"not audio")
        with self.assertRaisesRegex(RequestError, "20 seconds"):
            normalize_wav(wav_sample(21))

    def test_enforces_one_active_request(self) -> None:
        entered = threading.Event()
        release = threading.Event()

        def slow(_data: bytes) -> list[dict[str, str]]:
            entered.set()
            release.wait(2)
            return []

        service = RecognitionService(slow)
        first = threading.Thread(target=lambda: service.recognize(wav_sample()))
        first.start()
        self.assertTrue(entered.wait(1))
        with self.assertRaisesRegex(RequestError, "already running"):
            service.recognize(wav_sample())
        release.set()
        first.join(2)

    def test_does_not_impose_a_daily_request_cap(self) -> None:
        calls = []
        service = RecognitionService(lambda _data: calls.append(True) or [])
        sample = wav_sample()
        for _ in range(35):
            self.assertEqual(service.recognize(sample), [])
        self.assertEqual(len(calls), 35)


class OriginConfigurationTests(unittest.TestCase):
    def test_multi_origin_and_legacy_environment_configuration(self) -> None:
        with patch.dict("os.environ", {
            "ASF_EXTENSION_ORIGINS": "chrome-extension://oeamoddpghhjhhakjimcelbhjpjfboba,moz-extension://123e4567-e89b-12d3-a456-426614174000,safari-web-extension://123E4567-E89B-12D3-A456-426614174001",
            "ASF_EXTENSION_ORIGIN": "edge-extension://abcdefghijklmnopabcdefghijklmnop",
        }, clear=True):
            self.assertEqual(len(configured_extension_origins()), 4)

    def test_rejects_non_extension_origins_and_malformed_configuration(self) -> None:
        for origin in (
            "https://example.com", "http://localhost", "null", "*",
            "chrome-extension://oeamoddpghhjhhakjimcelbhjpjfboba/path",
            "moz-extension://123e4567-e89b-12d3-a456-426614174000:443",
            "safari-web-extension://user@123e4567-e89b-12d3-a456-426614174000",
        ):
            with self.subTest(origin=origin), patch.dict("os.environ", {"ASF_EXTENSION_ORIGINS": origin}, clear=True):
                with self.assertRaises(ValueError):
                    configured_extension_origins()

        with patch.dict("os.environ", {"ASF_EXTENSION_ORIGINS": ""}, clear=True):
            with self.assertRaises(ValueError):
                configured_extension_origins()


class WorkerProcessTests(unittest.TestCase):
    def test_songrec_passes_audio_to_cli_and_removes_it_after_cancellation(self) -> None:
        wav = wav_sample()
        samples = []

        def cancelled(command, **kwargs):
            self.assertEqual(command[1], "audio-file-to-recognized-song")
            sample = Path(command[2])
            self.assertEqual(sample.read_bytes(), wav)
            self.assertEqual(kwargs["input"], b"")
            samples.append(sample)
            raise RequestError(499, "Recognition cancelled.")

        with patch("server.songrec_executable", return_value=Path("songrec.exe")):
            with self.assertRaisesRegex(RequestError, "Recognition cancelled"):
                recognize_with_songrec(wav, cancelled)
        self.assertFalse(samples[0].exists())

    def test_songrec_accepts_a_shazam_match_or_empty_match_list(self) -> None:
        for payload, wanted in (({"track": {"title": "Song", "subtitle": "Singer"}}, [{"title": "Song", "artist": "Singer"}]), ({"matches": []}, [])):
            with self.subTest(payload=payload), patch("server.songrec_executable", return_value=Path("songrec.exe")):
                def runner(command, **kwargs):
                    return subprocess.CompletedProcess(command, 0, json.dumps(payload).encode(), b"")
                self.assertEqual(recognize_with_songrec(wav_sample(), runner), wanted)

    def test_worker_receives_wav_on_stdin_and_returns_valid_songs(self) -> None:
        output = json.dumps({"ok": True, "songs": [{"title": "Song", "artist": "Artist"}]}).encode()
        with patch("server.subprocess.run", return_value=subprocess.CompletedProcess([], 0, output, b"sensitive stderr")) as run:
            songs = recognize_in_subprocess(wav_sample())
        command = run.call_args.args[0]
        options = run.call_args.kwargs
        self.assertEqual(command[0], sys.executable)
        self.assertTrue(command[-1] == "--recognize-worker")
        self.assertNotIn(wav_sample(), command)
        self.assertEqual(options["input"], wav_sample())
        self.assertEqual(options["timeout"], 40)
        self.assertEqual(songs, [{"title": "Song", "artist": "Artist"}])

    def test_worker_timeout_is_a_504(self) -> None:
        with patch("server.subprocess.run", side_effect=subprocess.TimeoutExpired("worker", 40)):
            with self.assertRaisesRegex(RequestError, "timed out") as caught:
                recognize_in_subprocess(wav_sample())
        self.assertEqual(caught.exception.status, 504)

    def test_invalid_worker_json_or_song_shape_is_a_502_not_no_match(self) -> None:
        outputs = [b"not-json", b'{"ok":true,"songs":"empty"}']
        for output in outputs:
            with self.subTest(output=output), patch(
                "server.subprocess.run",
                return_value=subprocess.CompletedProcess([], 0, output, b"private stderr"),
            ):
                with self.assertRaises(RequestError) as caught:
                    recognize_in_subprocess(wav_sample())
                self.assertEqual(caught.exception.status, 502)

    def test_child_failure_never_exposes_stderr(self) -> None:
        completed = subprocess.CompletedProcess([], 2, b'{"ok":false}', b"raw provider exception")
        with patch("server.subprocess.run", return_value=completed):
            with self.assertRaises(RequestError) as caught:
                recognize_in_subprocess(wav_sample())
        self.assertEqual(caught.exception.status, 502)
        self.assertNotIn("raw provider exception", caught.exception.message)


class EndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.calls: list[bytes] = []
        service = RecognitionService(lambda data: self.calls.append(data) or [{"title": "Song", "artist": "Artist"}])
        self.allowed_origins = (
            DEFAULT_EXTENSION_ORIGIN,
            "moz-extension://123e4567-e89b-12d3-a456-426614174000",
            "safari-web-extension://123E4567-E89B-12D3-A456-426614174001",
        )
        self.server = ThreadingHTTPServer(
            ("127.0.0.1", 0), make_handler(service, self.allowed_origins, "")
        )
        self.server.RequestHandlerClass = make_handler(
            service, self.allowed_origins, f"127.0.0.1:{self.server.server_port}"
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)

    def test_disconnect_cancels_worker_and_releases_recognition_for_fresh_audio(self) -> None:
        service = RecognitionService()
        self.server.RequestHandlerClass = make_handler(
            service, self.allowed_origins, f"127.0.0.1:{self.server.server_port}"
        )
        requests = []

        def mock_shazam(audio, runner):
            requests.append(audio)
            if len(requests) == 1:
                runner([sys.executable, "-c", "import sys,time; sys.stdin.buffer.read(); time.sleep(30)"],
                       input=audio, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=8, check=False)
                self.fail("The disconnected worker was allowed to complete.")
            return [{"title": "New song", "artist": "New artist"}]

        headers = {"Content-Type": "audio/wav", "X-Anime-Song-Finder": "1"}
        first = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        with patch("server.recognize_in_subprocess", side_effect=mock_shazam):
            try:
                first.request("POST", "/recognize", body=wav_sample(), headers={**headers, "Origin": DEFAULT_EXTENSION_ORIGIN})
                deadline = time.monotonic() + 2
                while service._worker.process is None and time.monotonic() < deadline:
                    time.sleep(.02)
                process = service._worker.process
                self.assertIsNotNone(process)
                first.sock.shutdown(socket.SHUT_RDWR)
                first.close()
                deadline = time.monotonic() + 1
                while service._recognition_guard.locked() and time.monotonic() < deadline:
                    time.sleep(.02)
                self.assertIsNotNone(process.poll())
                status, _, body = self.request("POST", "/recognize", headers=headers, body=wav_sample(2))
                self.assertEqual(status, 200)
                self.assertEqual(json.loads(body)["songs"][0]["title"], "New song")
                self.assertEqual(len(requests), 2)
                self.assertNotEqual(requests[0], requests[1])
            finally:
                first.close()
                service.close()

    def request(self, method: str, path: str, *, origin: str | None = DEFAULT_EXTENSION_ORIGIN,
                headers: dict[str, str] | None = None, body: bytes | None = None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        request_headers = dict(headers or {})
        if origin is not None:
            request_headers["Origin"] = origin
        connection.request(method, path, body=body, headers=request_headers)
        response = connection.getresponse()
        payload = response.read()
        result = response.status, dict(response.getheaders()), payload
        connection.close()
        return result

    def test_health_and_exact_extension_preflight(self) -> None:
        status, headers, body = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"ok": True, "provider": "shazamio", "allowedOrigins": list(self.allowed_origins)})
        self.assertEqual(headers["Access-Control-Allow-Origin"], DEFAULT_EXTENSION_ORIGIN)
        status, _, _ = self.request("GET", "/health", headers={"Host": "localhost"})
        self.assertEqual(status, 403)

    def test_second_extension_origin_is_allowed_and_website_or_fake_path_is_rejected(self) -> None:
        firefox_origin = self.allowed_origins[1]
        status, headers, body = self.request("GET", "/health", origin=firefox_origin)
        self.assertEqual(status, 200)
        self.assertEqual(headers["Access-Control-Allow-Origin"], firefox_origin)
        self.assertEqual(json.loads(body)["allowedOrigins"], list(self.allowed_origins))

        safari_origin = self.allowed_origins[2]
        status, headers, _ = self.request("GET", "/health", origin=safari_origin)
        self.assertEqual(status, 200)
        self.assertEqual(headers["Access-Control-Allow-Origin"], safari_origin)

        status, _, _ = self.request("OPTIONS", "/recognize", origin=firefox_origin, headers={
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-anime-song-finder",
        })
        self.assertEqual(status, 204)
        status, headers, body = self.request(
            "POST", "/recognize", origin=firefox_origin,
            headers={"Content-Type": "audio/wav", "X-Anime-Song-Finder": "1"}, body=wav_sample(),
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers["Access-Control-Allow-Origin"], firefox_origin)
        self.assertEqual(json.loads(body), {"songs": [{"title": "Song", "artist": "Artist"}]})
        for origin in ("https://example.com", f"{DEFAULT_EXTENSION_ORIGIN}/fake"):
            with self.subTest(origin=origin):
                status, _, _ = self.request("GET", "/health", origin=origin)
                self.assertEqual(status, 403)

        status, headers, _ = self.request("OPTIONS", "/recognize", headers={
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-anime-song-finder",
        })
        self.assertEqual(status, 204)
        self.assertIn("X-Anime-Song-Finder", headers["Access-Control-Allow-Headers"])

        status, _, _ = self.request("OPTIONS", "/recognize", origin="https://evil.example", headers={
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-anime-song-finder",
        })
        self.assertEqual(status, 403)

    def test_recognize_requires_origin_marker_and_wav(self) -> None:
        common = {"Content-Type": "audio/wav", "X-Anime-Song-Finder": "1"}
        status, headers, body = self.request("POST", "/recognize", headers=common, body=wav_sample())
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"songs": [{"title": "Song", "artist": "Artist"}]})
        self.assertEqual(headers["Access-Control-Allow-Origin"], DEFAULT_EXTENSION_ORIGIN)
        self.assertEqual(len(self.calls), 1)

        status, _, _ = self.request("POST", "/recognize", origin="https://evil.example", headers=common, body=wav_sample())
        self.assertEqual(status, 403)
        status, _, _ = self.request("POST", "/recognize", headers={"Content-Type": "audio/wav"}, body=wav_sample())
        self.assertEqual(status, 403)
        status, _, _ = self.request("POST", "/recognize", headers={**common, "Content-Type": "application/octet-stream"}, body=wav_sample())
        self.assertEqual(status, 415)
        self.assertEqual(len(self.calls), 1)


if __name__ == "__main__":
    unittest.main()
