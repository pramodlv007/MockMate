"""Check question service Gemini status after redeploy."""
import asyncio, httpx

async def main():
    async with httpx.AsyncClient(timeout=30.0) as c:
        print("=== Health Check ===")
        r = await c.get("https://mockmate-question.onrender.com/health")
        print(r.json())

        print("\n=== Gemini Debug ===")
        r = await c.get("https://mockmate-question.onrender.com/debug/gemini")
        data = r.json()
        for k, v in data.items():
            print(f"  {k}: {v}")

asyncio.run(main())
