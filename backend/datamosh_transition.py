#!/usr/bin/env python3
"""
datamosh_transition.py — A -> datamosh melt -> B, as a single preset.

Classic cross-clip datamosh: clip A plays normally up to the transition
point, then clip B's frames are spliced in with their leading keyframe
physically removed. With no valid reference frame of its own, the decoder
falls back to A's last picture and keeps applying B's real motion vectors
and residuals on top of it — so B's motion "paints" itself over A's frozen
image, and the picture gradually resolves into B as more of its frames
arrive.

This is built on top of datamosh.py's ffgac-based encode (forced motion
vectors, no I-macroblock refresh) so the transition can be as short and
punchy or as long and smeary as you want, and — if you choose — never
fully "clean up" back to a normal B keyframe at all.

Requires: ffgac + ffedit (FFglitch) and ffprobe (regular FFmpeg), same as
datamosh.py. This file expects datamosh.py to be importable alongside it
(same directory), and reuses its helpers rather than duplicating them.

Usage (CLI):
    python3 datamosh_transition.py \\
        -a clip_a.mp4 -b clip_b.mp4 -o transition.avi \\
        --transition-at 8.0 --melt-duration 3.0

Usage (as a library):
    from datamosh_transition import datamosh_transition, TransitionResult

    result = datamosh_transition(
        clip_a="clip_a.mp4",
        clip_b="clip_b.mp4",
        output_path="transition.avi",
        transition_at_seconds=8.0,   # point in clip A where B starts moshing in
        melt_duration_seconds=3.0,   # None = never settles, stays moshed forever
    )
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import textwrap
from dataclasses import dataclass
from pathlib import Path

# Reuse the plumbing from the single-video tool instead of duplicating it.
from datamosh import DatamoshError, _run, _probe_fps


@dataclass
class TransitionResult:
    output_path: str
    fps: float
    frame_width: int
    frame_height: int
    transition_frame: int
    settle_frame: int | None  # None if the melt never settles


def _probe_resolution(ffprobe_bin: str, input_path: str) -> tuple[int, int]:
    cmd = [
        ffprobe_bin, "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "json",
        input_path,
    ]
    proc = _run(cmd, "ffprobe (reading resolution)")
    try:
        data = json.loads(proc.stdout)
        s = data["streams"][0]
        return int(s["width"]), int(s["height"])
    except (KeyError, IndexError, ValueError) as e:
        raise DatamoshError(f"Could not read resolution for {input_path}") from e


def _write_b_pict_type_script(path: Path, settle_frame: int | None, normal_gop: int) -> None:
    """Pict-type script for clip B's encode. Frame 0 must still be encoded
    as a real I-frame (ffgac needs a valid first reference to encode
    against) — we remove that I-frame's actual data later, at the byte
    level, once encoding is done. If settle_frame is given, B resumes
    normal periodic keyframes after that many frames so the mosh
    eventually cleans up into a crisp picture of B; if None, B never gets
    another real keyframe and the blend never fully resolves."""
    if settle_frame is None:
        body = """\
          if (f === 0) return "I";
          return "P";
        """
    else:
        body = f"""\
          if (f === 0) return "I";
          if (f < {settle_frame}) return "P";
          return (f % {normal_gop} === 0) ? "I" : "P";
        """
    script = "let frame_num = 0;\n\n" + textwrap.dedent(
        f"""\
        export function setup() {{
          frame_num = 0;
        }}

        export function pict_type_func() {{
          const f = frame_num++;
        {textwrap.indent(textwrap.dedent(body), '  ')}
        }}
        """
    )
    path.write_text(script)


# MPEG-4 part 2 start codes we need to walk the raw elementary stream.
_START_CODE = b"\x00\x00\x01"
_VOP_CODE = b"\x00\x00\x01\xb6"


def _strip_leading_iframe(data: bytes) -> bytes:
    """Removes exactly the first VOP (frame) payload from a raw MPEG-4
    elementary stream, leaving any preceding VOL/VOS header bytes intact.
    This is what turns clip B's first frame from 'a real picture' into
    'nothing, decode against whatever was there before' — the actual
    mechanism of the transition."""
    idx = data.find(_VOP_CODE)
    if idx == -1:
        raise DatamoshError(
            "Could not find a frame header in clip B's encoded stream — "
            "the encode may have failed or used an unexpected codec."
        )
    next_idx = data.find(_START_CODE, idx + 4)
    if next_idx == -1:
        next_idx = len(data)
    return data[:idx] + data[next_idx:]


def datamosh_transition(
    clip_a: str,
    clip_b: str,
    output_path: str,
    transition_at_seconds: float,
    melt_duration_seconds: float | None = None,
    ffgac_bin: str = "ffgac",
    ffedit_bin: str = "ffedit",
    ffmpeg_bin: str = "ffmpeg",
    ffprobe_bin: str = "ffprobe",
    normal_gop: int = 30,
    quality: int = 3,
    include_audio: bool = True,
    work_dir: str | None = None,
) -> TransitionResult:
    """
    Build an A -> datamosh melt -> B transition.

    transition_at_seconds: point in clip A where B starts bleeding in.
    melt_duration_seconds: how long after the transition before B is
        allowed a fresh, clean keyframe (picture fully "resolves").
        None = the blend never settles; the whole rest of B stays moshed.
    include_audio: if True, A's audio is used up to the transition and
        B's audio after it (simple hard cut, no crossfade).

    Raises DatamoshError with a UI-safe message on failure.
    """
    a_path, b_path = Path(clip_a), Path(clip_b)
    for label, p in (("clip_a", a_path), ("clip_b", b_path)):
        if not p.is_file():
            raise DatamoshError(f"{label} not found: {p}")

    if transition_at_seconds < 0:
        raise DatamoshError("transition_at_seconds must be >= 0")

    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    for name, exe in (
        ("ffgac", ffgac_bin), ("ffedit", ffedit_bin),
        ("ffmpeg", ffmpeg_bin), ("ffprobe", ffprobe_bin),
    ):
        if shutil.which(exe) is None and not Path(exe).is_file():
            raise DatamoshError(f"Could not find the '{name}' executable ('{exe}').")

    fps = _probe_fps(ffprobe_bin, str(a_path))
    width, height = _probe_resolution(ffprobe_bin, str(a_path))

    transition_frame = round(transition_at_seconds * fps)
    settle_frame = (
        round(melt_duration_seconds * fps) if melt_duration_seconds is not None else None
    )

    tmp_ctx = tempfile.TemporaryDirectory() if work_dir is None else None
    tmp_dir = Path(work_dir) if work_dir else Path(tmp_ctx.name)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    try:
        part_a = tmp_dir / "part_a.m4v"
        part_b_full = tmp_dir / "part_b_full.avi"
        part_b_es = tmp_dir / "part_b.m4v"
        part_b_stripped = tmp_dir / "part_b_stripped.m4v"
        combined_es = tmp_dir / "combined.m4v"
        video_only = tmp_dir / "video_only.avi"
        b_pict_script = tmp_dir / "b_pict_type.js"

        # 1. Clip A, up to the transition point, as a plain MPEG-4 elementary
        #    stream — same codec params B will be encoded with, so the two
        #    streams can be concatenated at the bitstream level.
        _run([
            ffmpeg_bin, "-y",
            "-i", str(a_path),
            "-t", f"{transition_at_seconds}",
            "-an",
            "-c:v", "mpeg4", "-q:v", str(quality),
            "-pix_fmt", "yuv420p",
            "-r", f"{fps}",
            "-f", "m4v",
            str(part_a),
        ], "ffmpeg (clip A pre-transition segment)")

        # 2. Clip B, full duration, scaled/matched to A's resolution, encoded
        #    with ffgac's forced-motion-vector / no-refresh settings so the
        #    blend can smear for as long as we want.
        _write_b_pict_type_script(b_pict_script, settle_frame, normal_gop)
        _run([
            ffgac_bin, "-y",
            "-i", str(b_path),
            "-vf", f"scale={width}:{height},setsar=1,fps={fps}",
            "-an",
            "-c:v", "mpeg4",
            "-mpv_flags", "+forcemv+nopimb",
            "-g", "999999", "-sc_threshold", "1000000000",
            "-pict_type_script", str(b_pict_script),
            "-q:v", str(quality),
            str(part_b_full),
        ], "ffgac (clip B encode)")

        # 3. Pull B's raw elementary stream out of the container, then strip
        #    its leading I-frame at the byte level — the actual "no valid
        #    reference frame" trick.
        _run([
            ffmpeg_bin, "-y",
            "-i", str(part_b_full),
            "-c:v", "copy", "-an",
            "-f", "m4v",
            str(part_b_es),
        ], "ffmpeg (extract clip B elementary stream)")

        part_b_stripped.write_bytes(_strip_leading_iframe(part_b_es.read_bytes()))

        # 4. Concatenate the two raw streams and remux into a real container.
        with open(combined_es, "wb") as out_f:
            out_f.write(part_a.read_bytes())
            out_f.write(part_b_stripped.read_bytes())

        _run([
            ffmpeg_bin, "-y",
            "-r", f"{fps}",
            "-i", str(combined_es),
            "-c:v", "copy",
            str(video_only),
        ], "ffmpeg (remux combined video)")

        if include_audio:
            audio_a = tmp_dir / "audio_a.aac"
            audio_b = tmp_dir / "audio_b.aac"
            audio_list = tmp_dir / "audio_list.txt"
            audio_combined = tmp_dir / "audio_combined.aac"

            _run([
                ffmpeg_bin, "-y", "-i", str(a_path),
                "-t", f"{transition_at_seconds}",
                "-vn", "-c:a", "aac",
                str(audio_a),
            ], "ffmpeg (clip A audio)")
            _run([
                ffmpeg_bin, "-y", "-i", str(b_path),
                "-vn", "-c:a", "aac",
                str(audio_b),
            ], "ffmpeg (clip B audio)")
            audio_list.write_text(f"file '{audio_a.name}'\nfile '{audio_b.name}'\n")
            _run([
                ffmpeg_bin, "-y",
                "-f", "concat", "-safe", "0",
                "-i", str(audio_list),
                "-c:a", "copy",
                str(audio_combined),
            ], "ffmpeg (concat audio)")
            _run([
                ffmpeg_bin, "-y",
                "-i", str(video_only), "-i", str(audio_combined),
                "-c:v", "copy", "-c:a", "aac",
                "-shortest",
                str(out_path),
            ], "ffmpeg (mux final audio+video)")
        else:
            shutil.copy2(video_only, out_path)

        return TransitionResult(
            output_path=str(out_path),
            fps=fps,
            frame_width=width,
            frame_height=height,
            transition_frame=transition_frame,
            settle_frame=settle_frame,
        )
    finally:
        if tmp_ctx is not None:
            tmp_ctx.cleanup()


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="A -> datamosh melt -> B transition preset.")
    p.add_argument("-a", "--clip-a", required=True, help="First (source) clip")
    p.add_argument("-b", "--clip-b", required=True, help="Second (destination) clip")
    p.add_argument("-o", "--output", required=True, help="Output file (.avi recommended)")
    p.add_argument("--transition-at", type=float, required=True,
                   help="Seconds into clip A where the melt into clip B begins")
    p.add_argument("--melt-duration", type=float, default=None,
                   help="Seconds after the transition before B gets a clean keyframe "
                        "(omit for a melt that never fully resolves)")
    p.add_argument("--normal-gop", type=int, default=30)
    p.add_argument("--quality", type=int, default=3)
    p.add_argument("--no-audio", action="store_true", help="Drop audio, output video-only")
    p.add_argument("--ffgac", default="ffgac")
    p.add_argument("--ffedit", default="ffedit")
    p.add_argument("--ffmpeg", default="ffmpeg")
    p.add_argument("--ffprobe", default="ffprobe")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _build_arg_parser().parse_args(argv)
    try:
        result = datamosh_transition(
            clip_a=args.clip_a,
            clip_b=args.clip_b,
            output_path=args.output,
            transition_at_seconds=args.transition_at,
            melt_duration_seconds=args.melt_duration,
            ffgac_bin=args.ffgac,
            ffedit_bin=args.ffedit,
            ffmpeg_bin=args.ffmpeg,
            ffprobe_bin=args.ffprobe,
            normal_gop=args.normal_gop,
            quality=args.quality,
            include_audio=not args.no_audio,
        )
    except DatamoshError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    print(f"Done -> {result.output_path}")
    print(f"  resolution: {result.frame_width}x{result.frame_height} @ {result.fps:.3f} fps")
    print(f"  transition at frame {result.transition_frame}")
    print(f"  settle frame: {result.settle_frame if result.settle_frame is not None else 'never (permanent blend)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
