import asyncio, httpx

async def test():
    async with httpx.AsyncClient(timeout=90.0) as c:
        r = await c.post('https://mockmate-question.onrender.com/generate', json={
            'company': 'Anthropic',
            'target_role': 'Research Engineer',
            'skills': 'PyTorch, Transformers, RLHF, Python',
            'job_description': 'Work on large language model alignment research. Experience with RLHF, Constitutional AI, and transformer architectures required. Strong Python and PyTorch skills needed.',
            'count': 3,
            'resume_text': ''
        })
        print('Status:', r.status_code)
        data = r.json()
        qs = data.get('questions', [])
        print(f'Questions returned: {len(qs)}')
        for i, q in enumerate(qs, 1):
            print(f'\n  Q{i}: {q[:200]}')

asyncio.run(test())
