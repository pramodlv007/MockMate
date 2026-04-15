"""Quick test: verify ML domain detection generates ML questions, not generic DSA."""
import asyncio, httpx, time

GATEWAY = "https://mockmate-gateway.onrender.com"

async def main():
    email = f"mltest_{int(time.time())}@example.com"
    async with httpx.AsyncClient(timeout=60.0) as c:

        # Signup
        r = await c.post(f"{GATEWAY}/auth/signup", json={
            "email": email, "password": "Test1234!", "full_name": "ML Tester",
            "skills": "PyTorch, Machine Learning, NLP, Transformers, MLOps, Python"
        })
        assert r.status_code == 200, f"Signup failed: {r.text}"
        token = r.json()["access_token"]
        print(f"Signed up: {email}")

        # Create ML interview
        r = await c.post(f"{GATEWAY}/interviews",
            json={
                "company_name": "DeepMind",
                "target_role": "ML Research Engineer",
                "job_description": """We are looking for an ML Research Engineer to join our team.
                You will train and fine-tune large language models using PyTorch and Hugging Face Transformers.
                Strong understanding of attention mechanisms, RLHF, and model evaluation required.
                Experience with MLOps, model serving, and distributed training on GPU clusters is a plus.
                Skills needed: Python, PyTorch, NLP, deep learning, transformer architecture.""",
                "questions_count": 3,
                "skills": "PyTorch, Machine Learning, NLP, Transformers, MLOps"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"\nInterview creation status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"Session: {data['id']}, status: {data['status']}")
            print(f"\nGenerated {len(data.get('questions', []))} questions:")
            for i, q in enumerate(data.get("questions", []), 1):
                print(f"\n  Q{i}: {q['content']}")
        else:
            print(f"Error: {r.text[:500]}")

asyncio.run(main())
