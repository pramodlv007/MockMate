"""
Test the current Gemini API key directly (from local .env).
This tells us if the key works at all before blaming Render.
"""
import os
from pathlib import Path
from dotenv import dotenv_values

config = dotenv_values(Path("backend/.env"))
key = config.get("GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY")

print(f"Key present locally: {bool(key)}")
if key:
    print(f"Key prefix: {key[:12]}...")

if not key:
    print("No GOOGLE_API_KEY in backend/.env - add it locally to test")
else:
    try:
        import google.generativeai as genai
        genai.configure(api_key=key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(
            'Return this JSON: {"questions": ["Explain attention mechanism in transformers."]}',
            generation_config={
                "temperature": 0.1,
                "max_output_tokens": 100,
                "response_mime_type": "application/json",
            }
        )
        print(f"SUCCESS: {resp.text[:200]}")
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")
