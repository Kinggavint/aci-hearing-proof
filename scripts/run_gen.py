"""Call imgserver to generate all images in parallel."""
import asyncio
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor

JOBS = [
    ("hearing-aid-repair-hero.jpg",
     "Close-up overhead photograph of a clean, professional audiologist's workbench. A small modern receiver-in-canal hearing aid being gently cleaned with a soft brush and small precision tools (tweezers, dome filter, microfiber cloth) arranged neatly. Soft natural daylight, clean white work surface with a hint of warm wood, clinical but inviting. No people, no faces. Photo-realistic. Healthcare professional aesthetic. Documentary style.",
     "16:9"),
    ("slide-restaurant-noise.jpg",
     "Photograph of a lively, crowded restaurant at dinner — warm pendant lights, blurred diners in background, foreground tables with food and conversation. A middle-aged woman, mid-50s, sitting across from a friend, leaning slightly forward, hand near her ear, expression of mild concentration trying to follow a conversation in noisy environment. Natural lighting, candid documentary photography style. Real-looking, not stock. Warm color tones. Diverse appearance.",
     "16:9"),
    ("slide-construction.jpg",
     "Photograph of a Black male construction worker in his 40s on a job site, wearing a hard hat with attached hearing protection earmuffs and a high-visibility vest. Daytime, blue sky, looking confident, mid-action holding building plans. Documentary-style real photography, no logos. Bright natural light. Representing occupational hearing health.",
     "16:9"),
    ("slide-musician.jpg",
     "Photograph of a young Latina woman in her 30s playing acoustic guitar on a small intimate venue stage, wearing visible custom musician earplugs/in-ear monitors. Warm stage lights, blurred audience in background. Candid live-music documentary style, joyful expression. Real-looking, photo-realistic, not stock.",
     "16:9"),
    ("slide-teacher.jpg",
     "Photograph of a male elementary school teacher in his late 50s, slightly graying hair, wearing a small modern receiver-in-canal hearing aid (visible behind ear). Standing in a bright sunlit classroom, mid-conversation with engaged students at desks (children's faces softly out of focus). Warm and approachable, candid documentary style. Real-looking, photo-realistic.",
     "16:9"),
    ("slide-parent-kids.jpg",
     "Photograph of an Asian father in his late 30s at a backyard birthday party with two laughing children. He wears a discreet modern hearing aid behind his ear. Sunny afternoon, balloons, casual happy family moment. Documentary-style real photography, not stock. Joyful expression.",
     "16:9"),
    ("slide-young-professional.jpg",
     "Photograph of a young professional woman in her late 20s, mixed-race, in a bright modern conference room mid-meeting, wearing nearly-invisible modern hearing aids. Confident, engaged expression, laptop open, colleagues blurred in background. Natural window light. Real-looking, candid corporate photography, not staged stock.",
     "16:9"),
]


def call(name, prompt, aspect):
    body = json.dumps({"name": name, "prompt": prompt, "aspect": aspect}).encode()
    req = urllib.request.Request(
        "http://127.0.0.1:8765/gen",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return name, json.loads(r.read())
    except Exception as e:
        return name, {"status": "fail", "error": str(e)}


def main():
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(call, n, p, a) for n, p, a in JOBS]
        for f in futures:
            name, res = f.result()
            print(f"{name}: {res}")


if __name__ == "__main__":
    main()
