"""Tiny image-gen server. Start with start_server + llm-api:website credentials."""
import sys
from pathlib import Path

sys.path.insert(0, "/home/user/workspace/skills/website-building/shared/llm-api")
from generate_image import generate_image  # noqa: E402

from fastapi import FastAPI, Body
import uvicorn

ASSETS = Path("/home/user/workspace/aci-hearing-proof/assets")
ASSETS.mkdir(parents=True, exist_ok=True)

app = FastAPI()


@app.post("/gen")
async def gen(payload: dict = Body(...)):
    name = payload["name"]
    prompt = payload["prompt"]
    aspect = payload.get("aspect", "16:9")
    out = ASSETS / name
    if out.exists():
        return {"status": "skip", "name": name, "size": out.stat().st_size}
    data = await generate_image(prompt, aspect_ratio=aspect)
    out.write_bytes(data)
    return {"status": "ok", "name": name, "size": len(data)}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="warning")
