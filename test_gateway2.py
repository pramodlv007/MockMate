import asyncio
import httpx

async def test():
    # Hit the gateway, get JSON exception handler output
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                'https://mockmate-gateway.onrender.com/interviews', 
                json={'company_name': 'Google', 'job_description': 'Test'}, 
                headers={'x-user-id': '49b68872-f279-41dc-9d03-61053eaaea6c'},
                timeout=30.0
            )
            print("Status:", resp.status_code)
            with open("gateway_out.txt", "w", encoding="utf-8") as f:
                f.write(resp.text)
    except Exception as e:
        print(f"Exception: {e}")

asyncio.run(test())
