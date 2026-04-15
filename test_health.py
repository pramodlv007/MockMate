"""Test all service health endpoints."""
import asyncio, httpx

SERVICES = {
    "Gateway":    "https://mockmate-gateway.onrender.com/health",
    "Auth":       "https://mockmate-auth.onrender.com/health",
    "Interview":  "https://mockmate-interview-s7nj.onrender.com/health",
    "Question":   "https://mockmate-question.onrender.com/health",
    "Evaluation": "https://mockmate-evaluation.onrender.com/health",
    "Profile":    "https://mockmate-profile.onrender.com/health",
}

async def main():
    async with httpx.AsyncClient(timeout=15.0) as c:
        tasks = {name: c.get(url) for name, url in SERVICES.items()}
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)
        for name, result in zip(tasks.keys(), results):
            if isinstance(result, Exception):
                print(f"  [ERR] {name}: {result}")
            else:
                icon = "OK " if result.status_code == 200 else "BAD"
                print(f"  [{icon}] {name}: {result.status_code} {result.text[:50]}")

asyncio.run(main())
