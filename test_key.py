import google.generativeai as genai
genai.configure(api_key='AIzaSyBYjxuwAPeej0iMsabFpDQoNqYFcYkNbHs')
model = genai.GenerativeModel('gemini-2.0-flash')
resp = model.generate_content(
    'Generate 1 ML interview question as JSON: {"questions": ["..."]}',
    generation_config={"temperature": 0.1, "max_output_tokens": 100, "response_mime_type": "application/json"}
)
print('SUCCESS:', resp.text[:200])
