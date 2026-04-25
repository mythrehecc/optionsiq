import urllib.request
import urllib.error
import json
import time
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE = "https://optionsiq.onrender.com"

def post_json(url, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json", "Origin": "http://localhost:3000"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, context=ctx) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

status, text = post_json(f"{BASE}/auth/signup", {"email": f"test_{int(time.time())}@example.com", "full_name": "Test User", "password": "Password123"})
print("Status:", status)
print("Response:", text.decode('utf-8', errors='ignore'))
