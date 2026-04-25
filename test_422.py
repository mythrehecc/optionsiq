import urllib.request
import urllib.error
import json

req = urllib.request.Request(
    "http://localhost:5000/dashboard/summary",
    headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"}
)

try:
    with urllib.request.urlopen(req) as r:
        print(r.status)
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode())
