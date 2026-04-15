"""
Test the exact same POST the browser sends, using the actual JWT from the browser request.
"""
import asyncio
import httpx

# The exact JWT from the browser's failed request
JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwcmFtb2RsdjAwN0BnbWFpbC5jb20iLCJ1c2VyX2lkIjoiYmM4MWJlNjAtODM5My00NzAzLTk3YTUtNjM4M2I3YWUwY2Q5IiwiZXhwIjoxNzc2MjIyMzkwfQ.tMrVEHxZ5uFjCbJBNzUCTjixramdUWDHnpUFFEwxo2g"
GATEWAY = "https://mockmate-gateway.onrender.com"

async def main():
    async with httpx.AsyncClient(timeout=60.0) as c:
        print("Testing interview creation with real browser JWT...")
        r = await c.post(
            f"{GATEWAY}/interviews",
            json={
                "company_name": "Google",
                "target_role": "Senior Backend Engineer",
                "job_description": "Build scalable distributed systems using Python, Go, PostgreSQL, Kubernetes.",
                "questions_count": 3,
                "duration_minutes": 15,
                "interviewer_persona": "neutral",
                "strictness_level": "standard"
            },
            headers={
                "Authorization": f"Bearer {JWT}",
                "Content-Type": "application/json",
                "Origin": "https://mockmate-frontend-ten.vercel.app",
            }
        )
        print(f"Status: {r.status_code}")
        print(f"Headers: content-type={r.headers.get('content-type')}")
        print(f"Body: {r.text[:500]}")

asyncio.run(main())
