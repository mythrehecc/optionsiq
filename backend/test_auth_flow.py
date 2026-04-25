"""
Full auth flow test — signs up, gets token, then calls /statements/ with Bearer token.
Run: python test_auth_flow.py
"""
import urllib.request
import urllib.error
import json
import time

BASE = "http://localhost:5000"

def post_json(url, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def get_authed(url, token):
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {token}"}, method="GET"
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {"error": str(e)}

# 1. Sign up a fresh test user
ts = int(time.time())
email = f"diagtest_{ts}@example.com"
print(f"[1] Signing up: {email}")
status, data = post_json(f"{BASE}/auth/signup", {
    "email": email,
    "full_name": "Diag Test",
    "password": "TestPass1"
})
print(f"    Status: {status}")
if status != 201:
    print(f"    ERROR: {data}")
    exit(1)

access_token = data.get("access_token")
print(f"    Token (first 50 chars): {access_token[:50]}...")

# 2. Call /auth/me with token
print(f"\n[2] GET /auth/me")
status, data = get_authed(f"{BASE}/auth/me", access_token)
print(f"    Status: {status}, data: {data}")

# 3. Call /statements/ with token
print(f"\n[3] GET /statements/")
status, data = get_authed(f"{BASE}/statements/", access_token)
print(f"    Status: {status}, data: {data}")

if status == 200:
    print("\n✅ SUCCESS — JWT auth is working correctly!")
else:
    print(f"\n❌ FAIL — Got {status}. Token is being rejected by Flask.")
