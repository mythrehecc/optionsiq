import urllib.request
import urllib.error
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Create a multipart form data manually
boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
body = (
    f"--{boundary}\r\n"
    f"Content-Disposition: form-data; name=\"file\"; filename=\"test.csv\"\r\n"
    f"Content-Type: text/csv\r\n\r\n"
    f"symbol,date,price\nAAPL,2023-01-01,150\r\n"
    f"--{boundary}\r\n"
    f"Content-Disposition: form-data; name=\"replace\"\r\n\r\n"
    f"false\r\n"
    f"--{boundary}--\r\n"
).encode('utf-8')

req = urllib.request.Request("https://optionsiq.onrender.com/statements/upload", data=body, method="POST")
req.add_header("Authorization", "Bearer BAD_TOKEN")
req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
req.add_header("Origin", "http://localhost:3000")

try:
    with urllib.request.urlopen(req, context=ctx, timeout=15) as res:
        print("Status:", res.status)
        print("Headers:", res.headers)
        print("Body:", res.read())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Headers:", e.headers)
except Exception as e:
    print("Error:", str(e))
