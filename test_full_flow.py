"""Full MockMate production end-to-end test."""
import asyncio, httpx, time

GATEWAY   = "https://mockmate-gateway.onrender.com"
AUTH      = "https://mockmate-auth.onrender.com"
INTERVIEW = "https://mockmate-interview-s7nj.onrender.com"
QUESTION  = "https://mockmate-question.onrender.com"

async def main():
    email = f"test_{int(time.time())}@example.com"
    async with httpx.AsyncClient(timeout=60.0) as c:

        print("\n=== Step 1: Health Checks ===")
        for name, url in [
            ("Gateway",   f"{GATEWAY}/health"),
            ("Auth",      f"{AUTH}/health"),
            ("Interview", f"{INTERVIEW}/health"),
            ("Question",  f"{QUESTION}/health"),
        ]:
            try:
                r = await c.get(url)
                icon = "OK" if r.status_code == 200 else "FAIL"
                print(f"  [{icon}] {name}: {r.status_code} {r.text[:60]}")
            except Exception as e:
                print(f"  [ERR] {name}: {e}")

        print("\n=== Step 2: Signup via Gateway ===")
        r = await c.post(f"{GATEWAY}/auth/signup", json={
            "email": email, "password": "TestPass123!", "full_name": "E2E Test"
        })
        print(f"  Status: {r.status_code}")
        if r.status_code not in (200, 201):
            print(f"  Body: {r.text[:400]}")
            return
        token = r.json()["access_token"]
        user_id = r.json()["user"]["id"]
        print(f"  [OK] user_id={user_id}")

        print("\n=== Step 3: Create Interview via Gateway ===")
        r = await c.post(f"{GATEWAY}/interviews",
            json={
                "company_name": "Google",
                "target_role": "Senior Backend Engineer",
                "job_description": "Build scalable distributed systems using Python, PostgreSQL, Kubernetes and Kafka.",
                "questions_count": 3,
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"  Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"  [OK] Session id={data['id']} status={data['status']}")
            print(f"  Questions generated: {len(data.get('questions', []))}")
            for i, q in enumerate(data.get("questions", [])[:2]):
                print(f"    Q{i+1}: {q['content'][:90]}")
        else:
            print(f"  BODY: {r.text[:500]}")

        print("\n=== Step 4: Direct Question Service ===")
        r = await c.post(f"{QUESTION}/generate", json={
            "company": "Google",
            "target_role": "Senior Backend Engineer",
            "skills": "Python, Kubernetes",
            "job_description": "Build scalable distributed systems using Python and Kubernetes.",
            "count": 2
        })
        print(f"  Status: {r.status_code}")
        if r.status_code == 200:
            qs = r.json().get("questions", [])
            print(f"  [OK] {len(qs)} questions returned")
            for q in qs[:2]:
                print(f"    - {q[:90]}")
        else:
            print(f"  BODY: {r.text[:400]}")

asyncio.run(main())
