import urllib.request
import urllib.error
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request("https://optionsiq.onrender.com/statements/", method="OPTIONS")
req.add_header("Origin", "http://localhost:3000")
req.add_header("Access-Control-Request-Method", "POST")
req.add_header("Access-Control-Request-Headers", "Authorization, Content-Type")

try:
    with urllib.request.urlopen(req, context=ctx, timeout=15) as res:
        print("Status:", res.status)
        print("CORS Allow Origin:", res.getheader("Access-Control-Allow-Origin"))
        print("CORS Allow Methods:", res.getheader("Access-Control-Allow-Methods"))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Headers:", e.headers)
except Exception as e:
    print("Error:", str(e))
