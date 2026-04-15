import urllib.request
import re

url = 'https://mockmate-frontend-ten.vercel.app/assets/index-CGbIc_uu.js'
with urllib.request.urlopen(url) as f:
    content = f.read().decode('utf-8', errors='ignore')

# Search for API URL patterns
matches = re.findall(r'https?://[a-z0-9.\-:]+(?:onrender\.com|localhost:\d+)[^\s"\']*', content)
print('URLs found in bundle:')
for m in matches[:10]:
    print(' -', m)

if not matches:
    print('VITE_API_URL is NOT set in Vercel - frontend calls http://localhost:8000')
    # Confirm by checking for the fallback string
    if 'localhost:8000' in content:
        print('CONFIRMED: localhost:8000 fallback is baked into the bundle')
    elif 'localhost' in content:
        idx = content.find('localhost')
        print('localhost context:', content[max(0,idx-30):idx+60])
