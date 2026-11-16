"""Check live helper connectivity with a generated tone; never records private audio."""
import io
import json
import math
from pathlib import Path
import struct
import time
import urllib.error
import urllib.request
import wave

data = io.BytesIO()
with wave.open(data, "wb") as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(32000)
    wav.writeframes(b"".join(struct.pack("<h", int(4000 * math.sin(2 * math.pi * 440 * i / 32000))) for i in range(32000 * 12)))
request = urllib.request.Request("http://127.0.0.1:18742/recognize", data=data.getvalue(), headers={
    "Origin": "chrome-extension://oeamoddpghhjhhakjimcelbhjpjfboba",
    "Content-Type": "audio/wav", "X-Anime-Song-Finder": "1",
}, method="POST")
started = time.monotonic()
try:
    with urllib.request.urlopen(request, timeout=50) as response:
        result = {"httpStatus": response.status, "response": json.load(response)}
except urllib.error.HTTPError as error:
    result = {"httpStatus": error.code, "response": json.load(error)}
except Exception as error:
    result = {"error": type(error).__name__, "message": str(error)}
result.update({"elapsedSeconds": round(time.monotonic() - started, 2), "scope": "Generated 12-second tone through real local helper. A no-match is expected; this is connectivity validation, not a positive music identification test."})
Path("docs/HELPER_CONNECTION_CHECK.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result))
