#!/usr/bin/env python3
"""
datamosh.py — one-shot "clean start, then melt forever" datamosh pipeline.

Wraps FFglitch's ffgac + ffedit into a single call:
  1. ffgac re-encodes the source as MPEG-4, forcing motion vectors
     everywhere, disabling I-macroblock refresh, and killing every
     automatic keyframe after frame 0 (via a generated pict_type_script).
  2. ffedit then freezes the motion vectors from the chosen mosh point
     onward, so every later frame keeps replaying stale motion against
     residual data that no longer matches — producing the classic
     compounding "melt" that never resets.

Requires the FFglitch binaries `ffgac` and `ffedit` (from
https://ffglitch.org — either the prebuilt release or a self-built
binary that supports `-pict_type_script`), plus `ffprobe` from a
normal FFmpeg install (used only to read the source fps).

Usage (CLI):
    python3 datamosh.py -i input.mp4 -o moshed.avi --mosh-start 5.0

Usage (as a library, e.g. from a GUI / web backend):
    from datamosh import datamosh, DatamoshError

    try:
        result = datamosh(
            input_path="input.mp4",
            output_path="moshed.avi",
            mosh_start_seconds=5.0,
        )
        print(result.output_path, result.mosh_start_frame, result.fps)
    except DatamoshError as e:
        # surface e to your UI
        ...
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


class DatamoshError(RuntimeError):
    """Raised for any failure in the datamosh pipeline, with a
    human-readable message safe to show directly in a UI."""


@dataclass
class DatamoshResult:
    output_path: str
    fps: float
    total_frames: int | None
    mosh_start_frame: int
    intermediate_path: str  # the pre-freeze ffgac output, kept for debugging


def _run(cmd: list[str], step_name: str) -> subprocess.CompletedProcess:
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, check=False
        )
    except FileNotFoundError as e:
        raise DatamoshError(
            f"{step_name}: could not find executable '{cmd[0]}'. "
            f"Check that the path is correct and the binary is executable."
        ) from e

    if proc.returncode != 0:
        tail = "\n".join(proc.stderr.strip().splitlines()[-25:])
        raise DatamoshError(f"{step_name} failed (exit {proc.returncode}):\n{tail}")
    return proc


def _probe_fps(ffprobe_bin: str, input_path: str) -> float:
    cmd = [
        ffprobe_bin,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=r_frame_rate",
        "-of", "json",
        input_path,
    ]
    proc = _run(cmd, "ffprobe (reading fps)")
    try:
        data = json.loads(proc.stdout)
        rate = data["streams"][0]["r_frame_rate"]  # e.g. "30000/1001" or "60/1"
        num, _, den = rate.partition("/")
        fps = float(num) / float(den or 1)
    except (KeyError, IndexError, ValueError, ZeroDivisionError) as e:
        raise DatamoshError(
            f"Could not determine input framerate from ffprobe output: {proc.stdout!r}"
        ) from e
    if fps <= 0:
        raise DatamoshError(f"ffprobe reported an invalid framerate: {fps}")
    return fps


def _probe_frame_count(ffprobe_bin: str, input_path: str) -> int | None:
    """Best-effort frame count, purely informational — not required for
    the pipeline to work, so failures here are non-fatal."""
    cmd = [
        ffprobe_bin,
        "-v", "error",
        "-select_streams", "v:0",
        "-count_frames",
        "-show_entries", "stream=nb_read_frames",
        "-of", "json",
        input_path,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=120)
        data = json.loads(proc.stdout)
        return int(data["streams"][0]["nb_read_frames"])
    except Exception:
        return None


def _write_pict_type_script(path: Path, mosh_start_frame: int, normal_gop: int) -> None:
    """Generates the ffgac -pict_type_script: real I-frame at 0, periodic
    I-frames every `normal_gop` frames before the mosh point, and P forever
    after it (never refreshed again)."""
    script = textwrap.dedent(f"""\
        let frame_num = 0;
        const MOSH_START = {mosh_start_frame};
        const NORMAL_GOP  = {normal_gop};

        export function setup() {{
          frame_num = 0;
        }}

        export function pict_type_func() {{
          const f = frame_num++;
          if (f === 0) return "I";
          if (f < MOSH_START)
            return (f % NORMAL_GOP === 0) ? "I" : "P";
          return "P";
        }}
        """)
    path.write_text(script)


def _write_freeze_mv_script(path: Path, mosh_start_frame: int) -> None:
    """Generates the ffedit glitch_frame script: from the mosh point on,
    freeze that frame's motion vectors and keep re-applying them to every
    subsequent frame."""
    script = textwrap.dedent(f"""\
        let frame_num = 0;
        const MOSH_START = {mosh_start_frame};
        let saved_mv = null;

        export function setup(args) {{
          args.features = [ "mv" ];
          frame_num = 0;
          saved_mv = null;
        }}

        export function glitch_frame(frame) {{
          const f = frame_num++;
          const fwd = frame.mv && frame.mv.forward;
          if (!fwd) return;
          if (f < MOSH_START) return;

          if (f === MOSH_START) {{
            saved_mv = JSON.parse(JSON.stringify(fwd));
          }}

          for (let i = 0; i < fwd.length; i++) {{
            const row = fwd[i];
            const savedRow = saved_mv[i];
            if (!savedRow) continue;
            for (let j = 0; j < row.length; j++) {{
              const sv = savedRow[j];
              if (sv) {{
                row[j][0] = sv[0];
                row[j][1] = sv[1];
              }}
            }}
          }}
        }}
        """)
    path.write_text(script)


def datamosh(
    input_path: str,
    output_path: str,
    mosh_start_seconds: float,
    ffgac_bin: str = "ffgac",
    ffedit_bin: str = "ffedit",
    ffprobe_bin: str = "ffprobe",
    normal_gop: int = 30,
    quality: int = 3,
    keep_intermediate: bool = False,
    work_dir: str | None = None,
) -> DatamoshResult:
    """
    Run the full datamosh pipeline on `input_path`, producing `output_path`.

    mosh_start_seconds: how many seconds into the video the melt should begin.
    normal_gop: how often (in frames) a real keyframe is inserted BEFORE the
                mosh point, for normal-looking playback up to that point.
    quality: ffgac -q:v value (lower = higher quality / bitrate, 2-31 range).
    keep_intermediate: if True, the pre-freeze ffgac output file is kept
                       next to the output instead of being deleted.
    work_dir: directory for generated scripts + intermediate file; a temp
              directory is used if not given.

    Raises DatamoshError with a UI-safe message on any failure.
    """
    in_path = Path(input_path)
    if not in_path.is_file():
        raise DatamoshError(f"Input file not found: {input_path}")

    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if mosh_start_seconds < 0:
        raise DatamoshError("mosh_start_seconds must be >= 0")

    for name, exe in (("ffgac", ffgac_bin), ("ffedit", ffedit_bin), ("ffprobe", ffprobe_bin)):
        if shutil.which(exe) is None and not Path(exe).is_file():
            raise DatamoshError(
                f"Could not find the '{name}' executable ('{exe}'). "
                f"Pass its full path explicitly if it's not on PATH."
            )

    fps = _probe_fps(ffprobe_bin, str(in_path))
    total_frames = _probe_frame_count(ffprobe_bin, str(in_path))
    mosh_start_frame = max(1, round(mosh_start_seconds * fps))

    if total_frames is not None and mosh_start_frame >= total_frames:
        raise DatamoshError(
            f"mosh_start_seconds ({mosh_start_seconds}s -> frame {mosh_start_frame}) "
            f"is at or past the end of the video ({total_frames} frames total)."
        )

    tmp_ctx = tempfile.TemporaryDirectory() if work_dir is None else None
    tmp_dir = Path(work_dir) if work_dir else Path(tmp_ctx.name)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    try:
        pict_type_script = tmp_dir / "pict_type.js"
        freeze_mv_script = tmp_dir / "freeze_mv.js"
        intermediate = tmp_dir / f"_intermediate{out_path.suffix or '.avi'}"

        _write_pict_type_script(pict_type_script, mosh_start_frame, normal_gop)
        _write_freeze_mv_script(freeze_mv_script, mosh_start_frame)

        # Stage 1: ffgac — dumb-encode with forced motion vectors, no
        # I-macroblock refresh in P frames, and no automatic keyframes
        # after frame 0.
        ffgac_cmd = [
            ffgac_bin,
            "-y",
            "-i", str(in_path),
            "-c:v", "mpeg4",
            "-mpv_flags", "+forcemv+nopimb",
            "-g", "999999",
            "-sc_threshold", "1000000000",
            "-pict_type_script", str(pict_type_script),
            "-q:v", str(quality),
            str(intermediate),
        ]
        _run(ffgac_cmd, "ffgac encode")

        # Stage 2: ffedit — freeze motion vectors from the mosh point on.
        ffedit_cmd = [
            ffedit_bin,
            "-y",
            "-i", str(intermediate),
            "-f", "mv",
            "-s", str(freeze_mv_script),
            "-o", str(out_path),
        ]
        _run(ffedit_cmd, "ffedit motion-vector freeze")

        if keep_intermediate:
            kept_path = out_path.with_name(out_path.stem + "_intermediate" + (out_path.suffix or ".avi"))
            shutil.copy2(intermediate, kept_path)
            intermediate_str = str(kept_path)
        else:
            intermediate_str = ""

        return DatamoshResult(
            output_path=str(out_path),
            fps=fps,
            total_frames=total_frames,
            mosh_start_frame=mosh_start_frame,
            intermediate_path=intermediate_str,
        )
    finally:
        if tmp_ctx is not None:
            tmp_ctx.cleanup()


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Automated datamosh: clean playback, then a melt that never resets."
    )
    p.add_argument("-i", "--input", required=True, help="Input video file")
    p.add_argument("-o", "--output", required=True, help="Output video file (.avi recommended)")
    p.add_argument(
        "--mosh-start", type=float, required=True,
        help="Seconds into the video where the melt should begin",
    )
    p.add_argument("--normal-gop", type=int, default=30,
                   help="Keyframe interval before the mosh point (default: 30)")
    p.add_argument("--quality", type=int, default=3,
                   help="ffgac -q:v value, 2 (best) - 31 (worst); default: 3")
    p.add_argument("--ffgac", default="ffgac", help="Path to the ffgac binary")
    p.add_argument("--ffedit", default="ffedit", help="Path to the ffedit binary")
    p.add_argument("--ffprobe", default="ffprobe", help="Path to ffprobe")
    p.add_argument("--keep-intermediate", action="store_true",
                   help="Keep the pre-freeze ffgac output alongside the final file")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _build_arg_parser().parse_args(argv)
    try:
        result = datamosh(
            input_path=args.input,
            output_path=args.output,
            mosh_start_seconds=args.mosh_start,
            ffgac_bin=args.ffgac,
            ffedit_bin=args.ffedit,
            ffprobe_bin=args.ffprobe,
            normal_gop=args.normal_gop,
            quality=args.quality,
            keep_intermediate=args.keep_intermediate,
        )
    except DatamoshError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    print(f"Done -> {result.output_path}")
    print(f"  fps: {result.fps:.3f}")
    print(f"  mosh starts at frame {result.mosh_start_frame}"
          + (f" of {result.total_frames}" if result.total_frames else ""))
    if result.intermediate_path:
        print(f"  intermediate kept at: {result.intermediate_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
