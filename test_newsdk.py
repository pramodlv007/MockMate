from google import genai

client = genai.Client(api_key='AIzaSyBYjxuwAPeej0iMsabFpDQoNqYFcYkNbHs')
resp = client.models.generate_content(
    model='models/gemini-2.0-flash-lite',
    contents='Generate 2 ML interview questions as JSON. Reply ONLY with: {"questions": ["q1", "q2"]}'
)
print('SUCCESS:', resp.text[:300])
