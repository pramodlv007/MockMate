import asyncio
import httpx
import traceback

async def test():
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                'https://mockmate-gateway.onrender.com/interviews', 
                json={'company_name': 'Google', 'job_description': 'Test'}, 
                headers={'x-user-id': '49b68872-f279-41dc-9d03-61053eaaea6c'}
            )
            print("Status:", resp.status_code)
            print("Response:", resp.text)
    except Exception as e:
        traceback.print_exc()

asyncio.run(test())
