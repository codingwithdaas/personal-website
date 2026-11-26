"""Copy every post from @inkeeratseyes into the site.

Run by .github/workflows/instagram.yml once a day. It:
  1. lists every post on the account,
  2. downloads each image once into assets/img/ig/ as .webp (Instagram's own
     image links expire, so the site serves its own copies),
  3. writes assets/data/instagram.json, which the Gallery section reads.

Two kinds of token work:
  * Unified login (every Meta app made since late Oct 2026): a system-user token
    for graph.facebook.com that never expires. Used first.
  * Instagram login (older apps): a 60-day token for graph.instagram.com, which
    this script renews every run and saves back with GH_PAT.

Needs: Python 3.10+ and Pillow. Environment:
  IG_TOKEN    the access token (required)
  IG_USER_ID  the Instagram account's ID (optional; looked up if missing)
  GH_PAT      only for Instagram-login tokens: a fine-grained GitHub token with
              "Secrets: read and write" on this repo, to save the renewed token
"""
import colorsys
import io
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "assets" / "img" / "ig"
DATA = ROOT / "assets" / "data" / "instagram.json"
API = "https://graph.instagram.com"  # Instagram login
FB_API = "https://graph.facebook.com/" + os.environ.get("META_GRAPH_VERSION", "v26.0")  # Unified login
MEDIA_FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}"
FULL_MAX = 1600   # longest side of the lightbox image
SMALL_SHORT = 600  # shortest side of the grid tile image


class ApiError(Exception):
    pass


def get_json(url, params):
    full = url + "?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(full, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(5 * (attempt + 1))
                continue
            # never print the token
            raise ApiError(f"API error {e.code} on {url.split('?')[0]}: {body[:400]}")
        except urllib.error.URLError:
            if attempt < 3:
                time.sleep(5 * (attempt + 1))
                continue
            raise


def refresh_token(token):
    """Extend the token another 60 days. Allowed once it is 24 hours old."""
    try:
        res = get_json(f"{API}/refresh_access_token", {"grant_type": "ig_refresh_token", "access_token": token})
    except ApiError as e:
        print(f"::warning::Token refresh skipped ({e}). This is normal on the first day.")
        return token
    new = res.get("access_token") or token
    days = int(res.get("expires_in", 0)) // 86400
    print(f"Token refreshed, valid for {days} more days.")
    if os.environ.get("GH_PAT"):
        env = {**os.environ, "GH_TOKEN": os.environ["GH_PAT"]}
        r = subprocess.run(["gh", "secret", "set", "IG_TOKEN", "--body", new], env=env, capture_output=True, text=True)
        if r.returncode:
            print(f"::warning::Could not save the refreshed token: {r.stderr.strip()[:300]}")
    elif new != token:
        print("::warning::GH_PAT is not set, so the refreshed token was not saved. Add it so the sync keeps working past 60 days.")
    return new


def unified_account(token):
    """Unified login: find the Instagram account this system-user token can read."""
    ig_id = os.environ.get("IG_USER_ID", "").strip()
    if not ig_id:
        res = get_json(f"{FB_API}/me/assigned_instagram_accounts", {"access_token": token})
        accounts = res.get("data", [])
        if not accounts:
            raise ApiError("the token has no Instagram account assigned; add @inkeeratseyes to the app's Unified login setup")
        ig_id = accounts[0]["id"]
    me = get_json(f"{FB_API}/{ig_id}", {"fields": "username", "access_token": token})
    return f"{FB_API}/{ig_id}/media", me.get("username")


def all_media(token, media_url):
    url, params = media_url, {"fields": MEDIA_FIELDS, "limit": 50, "access_token": token}
    while url:
        page = get_json(url, params)
        yield from page.get("data", [])
        url = page.get("paging", {}).get("next")
        params = {}  # the "next" link already carries every parameter


def glow_of(im):
    """A bright, saturated colour from the photo, for the page to glow with on hover."""
    small = im.convert("RGB").resize((32, 32))
    px = []
    for r, g, b in small.getdata():
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        px.append((s * v, r, g, b))
    px.sort(reverse=True)
    top = px[: max(1, len(px) // 6)]
    r = sum(p[1] for p in top) / len(top)
    g = sum(p[2] for p in top) / len(top)
    b = sum(p[3] for p in top) / len(top)
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    r, g, b = colorsys.hsv_to_rgb(h, max(s, 0.55), max(v, 0.97))
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def save_image(url, stem):
    """Download once; return sizes and paths. Skips the download if already saved."""
    full_p, sm_p = IMG_DIR / f"{stem}.webp", IMG_DIR / f"{stem}-sm.webp"
    meta_p = IMG_DIR / f"{stem}.json"
    if full_p.exists() and sm_p.exists() and meta_p.exists():
        return json.loads(meta_p.read_text())
    with urllib.request.urlopen(url, timeout=120) as r:
        im = Image.open(io.BytesIO(r.read()))
        im = ImageOps.exif_transpose(im).convert("RGB")
    full = im.copy()
    full.thumbnail((FULL_MAX, FULL_MAX), Image.LANCZOS)
    full.save(full_p, "WEBP", quality=82, method=6)
    scale = SMALL_SHORT / min(im.size)
    sm = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS) if scale < 1 else im.copy()
    sm.save(sm_p, "WEBP", quality=78, method=6)
    meta = {
        "src": f"assets/img/ig/{stem}.webp", "w": full.width, "h": full.height,
        "sm": f"assets/img/ig/{stem}-sm.webp", "sw": sm.width, "sh": sm.height,
        "glow": glow_of(im),
    }
    meta_p.write_text(json.dumps(meta))
    return meta


def alt_for(caption):
    text = " ".join((caption or "").split())
    if not text:
        return "Photo by Keerat from @inkeeratseyes"
    first = text.split(". ")[0]
    return "Photo by Keerat: " + (first[:120] + "…" if len(first) > 120 else first)


def main():
    token = os.environ.get("IG_TOKEN")
    if not token:
        raise SystemExit("IG_TOKEN is not set. Add it under Settings → Secrets and variables → Actions.")
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    try:
        media_url, username = unified_account(token)
        print("Using Unified login (graph.facebook.com).")
    except ApiError as unified_err:
        try:  # an older Instagram-login token
            username = get_json(f"{API}/me", {"fields": "username", "access_token": token}).get("username")
        except ApiError as ig_err:
            raise SystemExit(f"The token didn't work.\n  Unified login: {unified_err}\n  Instagram login: {ig_err}")
        print("Using Instagram login (graph.instagram.com).")
        token = refresh_token(token)
        media_url = f"{API}/me/media"
    username = username or "inkeeratseyes"

    posts, keep = [], set()
    for m in all_media(token, media_url):
        kind = m.get("media_type")
        parts = m.get("children", {}).get("data") if kind == "CAROUSEL_ALBUM" else [m]
        images = []
        for c in parts or []:
            url = c.get("thumbnail_url") if c.get("media_type") == "VIDEO" else c.get("media_url")
            if not url:
                continue  # e.g. a video Instagram gives no still for
            stem = c["id"]
            try:
                meta = save_image(url, stem)
            except Exception as e:  # one bad image should not stop the sync
                print(f"::warning::Skipped image {stem}: {e}")
                continue
            keep.add(stem)
            images.append({**meta, "video": c.get("media_type") == "VIDEO"})
        if not images:
            continue
        posts.append({
            "id": m["id"],
            "type": kind,
            "permalink": m.get("permalink"),
            "timestamp": m.get("timestamp"),
            "caption": m.get("caption", ""),
            "alt": alt_for(m.get("caption")),
            "glow": images[0]["glow"],
            "images": images,
        })

    old = json.loads(DATA.read_text()) if DATA.exists() else {}
    if not posts and old.get("posts"):
        # an empty answer is far likelier to be an Instagram hiccup than every post being deleted
        raise SystemExit("Instagram returned no posts; keeping the current gallery unchanged.")

    # remove photos of posts that were deleted on Instagram
    for f in IMG_DIR.iterdir():
        if f.name.startswith("."):
            continue  # .gitkeep
        stem = f.name.split(".")[0].removesuffix("-sm")
        if stem not in keep:
            f.unlink()

    posts.sort(key=lambda p: p.get("timestamp") or "", reverse=True)
    out = {
        "username": username,
        "profile": f"https://www.instagram.com/{username}/",
        "posts": posts,
    }
    if {k: v for k, v in old.items() if k != "updated"} != out:
        out["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        DATA.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
        print(f"Saved {len(posts)} posts.")
    else:
        print(f"No changes ({len(posts)} posts).")


if __name__ == "__main__":
    sys.exit(main())
