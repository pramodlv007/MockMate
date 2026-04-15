"""Test Gemini REST API directly - no SDK required."""
import httpx, json
from pathlib import Path
from dotenv import dotenv_values

config = dotenv_values(Path("backend/.env"))
key = config.get("GOOGLE_API_KEY") or ""
print(f"Key present: {bool(key)} ({key[:12]}...)" if key else "No key in backend/.env")

if key:
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent"
    payload = {
        "contents": [{"parts": [{"text": 'Generate 2 ML interview questions. Reply ONLY with {"questions": ["q1", "q2"]}'}]}],
        "generationConfig": {"temperature": 0.8, "maxOutputTokens": 300}
    }
    resp = httpx.post(url, params={"key": key}, json=payload, timeout=30.0)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        print(f"Response: {text[:300]}")
    else:
        print(f"Error: {resp.text[:400]}")
