"""Wake up sleeping services with extended timeout."""
import asyncio, httpx

SLEEPING = {
    "Question":   "https://mockmate-question.onrender.com/health",
    "Evaluation": "https://mockmate-evaluation.onrender.com/health",
    "Profile":    "https://mockmate-profile.onrender.com/health",
}

async def wake(name, url):
    print(f"  Pinging {name}...")
    for attempt in range(4):
        try:
            async with httpx.AsyncClient(timeout=45.0) as c:
                r = await c.get(url)
                if r.status_code == 200:
                    print(f"  [AWAKE] {name}: {r.text[:50]}")
                    return True
                else:
                    print(f"  [{r.status_code}] {name}: attempt {attempt+1}, retrying in 20s...")
                    await asyncio.sleep(20)
        except Exception as e:
            print(f"  [ERR] {name}: {e} — retrying in 20s...")
            await asyncio.sleep(20)
    print(f"  [FAILED] {name}: didn't wake after 4 attempts")
    return False

async def main():
    print("Waking up sleeping services (may take 30-60s each)...")
    results = await asyncio.gather(*[wake(n, u) for n, u in SLEEPING.items()])
    awake = sum(results)
    print(f"\n{awake}/{len(SLEEPING)} services awake.")

asyncio.run(main())
