"""List all Gemini models available for this API key."""
from google import genai

client = genai.Client(api_key='AIzaSyBYjxuwAPeej0iMsabFpDQoNqYFcYkNbHs')

try:
    models = list(client.models.list())
    print(f"Available models ({len(models)}):")
    for m in models:
        if 'gemini' in m.name.lower():
            print(f"  - {m.name}")
except Exception as e:
    print(f"Error listing models: {type(e).__name__}: {e}")
