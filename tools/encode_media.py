"""Encode the raw recordings in MEEEEDIAAA/ into web-sized files in media/.

The raw files are far too big to serve: the home recording alone is 281 MB
(3 min 41 s of 1080p) and GitHub refuses any file over 100 MB. This script
cuts and compresses them into H.264 MP4s with the moov atom up front, so a
browser can start playing before the download finishes. It also regenerates
each poster from the first frame of the encoded clip, so the still a visitor
sees while the video loads is the frame it starts on.

Needs ffmpeg, from either of:
    winget install Gyan.FFmpeg            (puts ffmpeg on PATH)
    python -m pip install imageio-ffmpeg  (bundles a binary)

Usage, from the site root:
    python tools/encode_media.py              # all of them
    python tools/encode_media.py hero         # just one

Tune a clip in JOBS below: `start`/`dur` pick the segment (seconds),
`crf` the quality (lower = sharper and bigger). Clips are always encoded at
their native size; the site shows them 1:1, so nothing may be scaled.
"""
from __future__ import annotations

import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "MEEEEDIAAA"
OUT = ROOT / "media"

# SHARPNESS RULE: the site shows every clip at exactly one source pixel per
# screen pixel, so the encode must not lose detail either. Native size (no
# scaling), CRF 17, and x264's "animation" tuning, which suits flat colours
# and hard edges: exactly what a UI recording is. Files are bigger for it.
JOBS = {
    "hero": dict(src=SRC / "Home Page" / "homepage BG.mp4", out="hero.mp4",
                 poster="hero-poster.webp", start=0, dur=40, crf=17),
    "orderbook": dict(src=SRC / "Features" / "feature - Order Book.mp4", out="orderbook.mp4",
                      poster="orderbook-poster.webp", start=0, dur=None, crf=17),
    "optionflow": dict(src=SRC / "Features" / "Feature - Option Flow.MOV", out="optionflow.mp4",
                       poster="optionflow-poster.webp", start=0, dur=None, crf=16),
    "optionchain": dict(src=SRC / "Features" / "Feature - Option Chain Look.mp4", out="optionchain.mp4",
                        poster="optionchain-poster.webp", start=0, dur=None, crf=17),
}

WARN_MB = 25


def ffmpeg_exe() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg  # type: ignore
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("ffmpeg not found. Install it with `winget install Gyan.FFmpeg` "
                 "or `python -m pip install imageio-ffmpeg`, then run this again.")


def run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"ffmpeg failed:\n{r.stderr[-2000:]}")


def encode(name: str, job: dict, ff: str) -> None:
    src = job["src"]
    if not src.exists():
        sys.exit(f"missing source: {src}")
    out = OUT / job["out"]
    tmp = out.with_suffix(".tmp.mp4")

    cmd = [ff, "-y", "-hide_banner", "-loglevel", "error"]
    if job["start"]:
        cmd += ["-ss", str(job["start"])]
    cmd += ["-i", str(src)]
    if job["dur"]:
        cmd += ["-t", str(job["dur"])]
    cmd += [
        "-an",                                   # every clip plays muted
        "-vf", "format=yuv420p",                 # native size: never rescale
        "-c:v", "libx264", "-preset", "slow", "-tune", "animation", "-crf", str(job["crf"]),
        "-profile:v", "high", "-level", "4.1",
        "-movflags", "+faststart",               # playable while downloading
        str(tmp),
    ]
    print(f"[{name}] encoding {src.name} -> media/{out.name} ...", flush=True)
    run(cmd)
    os.replace(tmp, out)                         # replaces the staged full-size copy

    poster = OUT / job["poster"]
    # first frame, near-lossless, at native size (what shows before playback)
    run([ff, "-y", "-hide_banner", "-loglevel", "error", "-i", str(out),
         "-frames:v", "1", "-c:v", "libwebp", "-quality", "95", str(poster)])

    mb = out.stat().st_size / 1e6
    flag = f"   <-- over {WARN_MB} MB, raise crf or shorten dur" if mb > WARN_MB else ""
    print(f"[{name}] {mb:.1f} MB, poster {poster.stat().st_size / 1e3:.0f} KB{flag}")


def main() -> None:
    names = sys.argv[1:] or list(JOBS)
    unknown = [n for n in names if n not in JOBS]
    if unknown:
        sys.exit(f"unknown clip(s): {', '.join(unknown)}. Choose from: {', '.join(JOBS)}")
    OUT.mkdir(exist_ok=True)
    ff = ffmpeg_exe()
    for n in names:
        encode(n, JOBS[n], ff)


if __name__ == "__main__":
    main()
