"""Exercise real native framing/launch/reuse, without capturing or submitting audio."""
import json
from pathlib import Path
import struct
import subprocess
import time

root = Path(__file__).resolve().parent.parent
exe = root / "local-data/native-host/OtoneNativeHost.exe"
origin = "chrome-extension://oeamoddpghhjhhakjimcelbhjpjfboba/"


def call(caller, message):
    raw = json.dumps(message).encode()
    started = time.monotonic()
    result = subprocess.run([str(exe), caller], input=struct.pack("<I", len(raw)) + raw,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=26,
                            creationflags=subprocess.CREATE_NO_WINDOW)
    output = result.stdout
    if len(output) < 4 or struct.unpack("<I", output[:4])[0] != len(output[4:]):
        raise RuntimeError("Native host framing failed; exit=" + str(result.returncode))
    return {"exitCode": result.returncode, "response": json.loads(output[4:]), "elapsedSeconds": round(time.monotonic() - started, 3)}


first = call(origin, {"type": "ensureHelper"})
pid_first = (root / "local-data/helper.pid").read_text().strip()
second = call(origin, {"type": "ensureHelper"})
pid_second = (root / "local-data/helper.pid").read_text().strip()
unauthorized = call("https://not-an-extension.invalid/", {"type": "ensureHelper"})
wrong_command = call(origin, {"type": "exec", "command": "not-permitted"})
passed = (first["response"].get("ok") is True and second["response"].get("status") == "already-running"
          and pid_first == pid_second and unauthorized["response"].get("ok") is False
          and wrong_command["response"].get("ok") is False)
report = {"scope": "Actual compiled native executable and binary protocol, no audio; cold start only if first response says started.",
          "first": first, "second": second, "sameHelperPid": pid_first == pid_second,
          "unauthorized": unauthorized, "wrongCommand": wrong_command, "passed": passed}
(root / "docs/NATIVE_HELPER_LIVE_RESULTS.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report))
raise SystemExit(0 if passed else 1)
