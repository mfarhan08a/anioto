import contextlib
import io
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock, patch

import native_host as host
import browser_session as session

ORIGIN = "chrome-extension://oeamoddpghhjhhakjimcelbhjpjfboba"
HEALTH = {"ok": True, "provider": "shazamio", "allowedOrigins": [ORIGIN]}
TEST_TEMP = Path(__file__).resolve().parent.parent / "local-data/native-tests"
TEST_TEMP.mkdir(parents=True, exist_ok=True)


def frame(value):
    raw = json.dumps(value).encode()
    return io.BytesIO(struct.pack("<I", len(raw)) + raw)


class NativeHostTests(unittest.TestCase):
    def test_valid_command_and_frame(self):
        self.assertEqual(host.read_message(frame({"type": "ensureHelper"})), {"type": "ensureHelper"})

    def test_rejects_invalid_frames_and_other_commands(self):
        for raw in [b"", b"\x01", struct.pack("<I", 0), struct.pack("<I", 4097), struct.pack("<I", 5) + b"{}"]:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                host.read_message(io.BytesIO(raw))
        for value in [None, [], "ensureHelper", {"type": "exec", "command": "cmd"}, {"type": "ensureHelper", "path": "evil.exe"}]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                host.read_message(frame(value))

    def test_origins_are_exact_and_config_is_validated(self):
        host.authorize(ORIGIN + "/", [ORIGIN])
        for caller in ["https://example.com", ORIGIN + "/path", ORIGIN + "//", "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/"]:
            with self.subTest(caller=caller), self.assertRaises(ValueError):
                host.authorize(caller, [ORIGIN])
        with tempfile.TemporaryDirectory(dir=TEST_TEMP) as temp:
            config = Path(temp) / "manifest.json"
            config.write_text(json.dumps({"allowed_origins": [ORIGIN + "/"]}))
            self.assertEqual(host.allowed_origins(config), [ORIGIN])
            config.write_text(json.dumps({"allowed_origins": ["https://example.com/"]}))
            with self.assertRaises(ValueError):
                host.allowed_origins(config)

    def test_valid_request_produces_only_a_framed_response(self):
        output = io.BytesIO()
        with patch.object(host, "allowed_origins", return_value=[ORIGIN]), patch.object(host, "browser_session", side_effect=contextlib.nullcontext), patch.object(host, "ensure_helper", return_value="already-running") as ensure:
            self.assertEqual(host.run(frame({"type": "ensureHelper"}), output, ORIGIN + "/"), 0)
        raw = output.getvalue()
        self.assertEqual(struct.unpack("<I", raw[:4])[0], len(raw[4:]))
        self.assertEqual(json.loads(raw[4:]), {"ok": True, "status": "already-running"})
        ensure.assert_called_once_with([ORIGIN])

    def test_unauthorized_origin_cannot_launch_any_process(self):
        output = io.BytesIO()
        with patch.object(host, "allowed_origins", return_value=[ORIGIN]), patch.object(host, "ensure_helper") as ensure:
            self.assertEqual(host.run(frame({"type": "ensureHelper"}), output, "https://evil.test"), 1)
            ensure.assert_not_called()
        self.assertFalse(json.loads(output.getvalue()[4:])["ok"])

    def test_reuses_healthy_helper_and_rejects_wrong_allowlist(self):
        with patch.object(host, "launch_lock", side_effect=contextlib.nullcontext), patch.object(host, "health", return_value=HEALTH), patch.object(host.subprocess, "Popen") as popen:
            self.assertEqual(host.ensure_helper([ORIGIN]), "already-running")
            popen.assert_not_called()
        with patch.object(host, "launch_lock", side_effect=contextlib.nullcontext), patch.object(host, "health", return_value={**HEALTH, "allowedOrigins": []}):
            with self.assertRaisesRegex(RuntimeError, "does not allow"):
                host.ensure_helper([ORIGIN])

    def test_cold_start_launches_only_fixed_project_files_with_exact_origins(self):
        with tempfile.TemporaryDirectory(dir=TEST_TEMP) as temp:
            root = Path(temp)
            (root / "local-data/runtime").mkdir(parents=True)
            (root / "helper").mkdir()
            (root / "local-data/runtime/python.exe").touch()
            (root / "helper/server.py").touch()
            process = Mock(pid=123, poll=Mock(return_value=None))
            with patch.object(host, "ROOT", root), patch.object(host, "launch_lock", side_effect=contextlib.nullcontext), patch.object(host, "health", side_effect=[None, HEALTH]), patch.object(host.subprocess, "Popen", return_value=process) as popen:
                self.assertEqual(host.ensure_helper([ORIGIN]), "started")
                args, kwargs = popen.call_args
                self.assertEqual(args[0], [str(root / "local-data/runtime/python.exe"), str(root / "helper/server.py"), "--browser-managed"])
                self.assertEqual(kwargs["env"]["ASF_EXTENSION_ORIGINS"], ORIGIN)
                self.assertNotIn("ASF_EXTENSION_ORIGIN", kwargs["env"])
                self.assertFalse(kwargs.get("shell", False))
                self.assertEqual((root / "local-data/helper.pid").read_text(), "123")

    @unittest.skipUnless(os.name == "nt", "Windows file locks")
    def test_multiple_browser_sessions_and_stale_file_cleanup(self):
        with tempfile.TemporaryDirectory(dir=TEST_TEMP) as temp, patch.object(session, "HOST_DIR", Path(temp)):
            self.assertFalse(session.has_browser_session())
            with session.browser_session():
                with session.browser_session():
                    self.assertTrue(session.has_browser_session())
                self.assertTrue(session.has_browser_session())
            stale = Path(temp) / "sessions" / "stale.lease"
            stale.touch()
            self.assertFalse(session.has_browser_session(prune=True))
            self.assertFalse(stale.exists())

    def test_browser_shutdown_cancels_the_recognition_worker(self):
        from server import BrowserRecognitionWorker

        worker = BrowserRecognitionWorker()
        results = []
        thread = threading.Thread(target=lambda: results.append(worker.run(
            [sys.executable, "-c", "import time; time.sleep(30)"],
            input=b"", stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=6, check=False,
        )), daemon=True)
        thread.start()
        try:
            deadline = time.monotonic() + 3
            while worker.process is None and time.monotonic() < deadline:
                time.sleep(0.025)
            self.assertIsNotNone(worker.process)
        finally:
            worker.close()
            thread.join(timeout=3)
        self.assertFalse(thread.is_alive())
        self.assertEqual(len(results), 1)
        self.assertNotEqual(results[0].returncode, 0)


if __name__ == "__main__":
    unittest.main()
