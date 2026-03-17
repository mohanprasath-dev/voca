import asyncio, json, websockets, time

async def test():
    try:
        async with websockets.connect("ws://localhost:8000/ws/browser/apex") as ws:
            msg = json.loads(await ws.recv())
            print(f"1. Connected: {msg.get('type')}")
            
            # Send dummy audio
            await ws.send(bytes(32000))
            start = time.time()
            await ws.send(json.dumps({"type": "end_of_speech"}))
            
            got_transcript = False
            got_response = False
            got_audio = False
            
            for i in range(20):
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=20)
                    if isinstance(msg, bytes):
                        if not got_audio:
                            print(f"3. First audio chunk: {time.time()-start:.2f}s, {len(msg)} bytes")
                            got_audio = True
                    else:
                        data = json.loads(msg)
                        t = data.get("type")
                        print(f"   Message at {time.time()-start:.2f}s: {t} - {str(data)[:80]}")
                        if t == "transcript": got_transcript = True
                        if t == "response": got_response = True
                    if got_transcript and got_response and got_audio:
                        print("SUCCESS: All 3 pipeline stages verified")
                        break
                except asyncio.TimeoutError:
                    print("TIMEOUT waiting for response")
                    break
    except Exception as e:
        print(f"Connection error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
