"""
Builds Seti's official marks, and the app icon, from the supplied sources.

    python3 generate.py            # build into this folder
    python3 generate.py --install  # build, then copy to web/public and web/app

WHY THIS SCRIPT EXISTS
The two 500px "alien face" PNGs are not a matched pair. Measured:

    neutral   rgb(223,214,205) cream head, 14,850 opaque black px of eye
    friendly  rgb(244,243,241) white head, 13,144 px of eye at alpha 0, no ink
              anywhere in the file; the mouth is a <=1/255 emboss

The brand rule is that the neutral is the source of truth and the expression is
the only difference, so the friendly file cannot ship beside the neutral one as
it stands: different head colour, and eyes that punch through to whatever is
behind them.

The third upload, `Friendly Alien Face Icon.png` (1254px, white on near-black),
is a usable rendering: its head is the same shape as the neutral's (aspect
0.7727 vs 0.7740, both eyes inside 0.5% after normalising) and it carries a
real drawn smile. So:

  * body, shading, eyes, colour   -> the NEUTRAL file, pixel for pixel
  * the smile's geometry          -> lifted from the 1254px icon and warped
                                     into the neutral's pixel space

which gives marks that genuinely differ only by the expression:

  seti-mark-neutral.png        cream head, ink eyes              (on canvas-light)
  seti-mark-friendly.png       cream head, ink eyes + smile      (on canvas-light)
  seti-mark-neutral-dark.png   white head, eyes punched to alpha 0
  seti-mark-friendly-dark.png  white head, eyes + smile punched
  seti-mark-neutral-code.png   ink head, eyes punched            (in a code's well)
  seti-mark-friendly-code.png  ink head, eyes + smile punched    (in a code's well)

Eyes are PUNCHED on the mono pair rather than filled dark: the dark canvas is
black and a painted pupil breaks the moment the mark sits on anything else. The
code colourway is the same argument one surface further in — its well is white,
so a punched eye is a white eye and the head is one solid ink shape.

Every mark shares one crop, one scale and one canvas, so swapping expression,
colourway or canvas never shifts the mark by a pixel.
"""

from pathlib import Path
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / "source"
REPO = HERE.parents[2]

NEUTRAL_SRC = SOURCE / "No_Smile_Alien_Face.png"
FRIENDLY_SRC = SOURCE / "Friendly Alien Face Icon.png"

CANVAS = 384
# Cropping is the one place this pipeline can quietly hold a lie: the supplied
# 500px file carries 653 pixels of alpha<=64 haze out to its own canvas edges, so
# an alpha>0 bounding box is the whole 500x500, not the head, and the mark ends up
# two thirds of the frame it is measured by. The box is taken on the SOLID head
# (alpha>128) and padded by a fixed optical margin instead.
OPTICAL_MARGIN = 0.04  # of head height, on each side
MINUSCULE = 0.4  # mask feather, px

MOUTH_INK = (26, 22, 23)
DARK_INK = (255, 255, 255)
# Ink — `--color-canvas-dark` in `web/app/globals.css` (`#000000`), the same literal
# the code's modules are drawn in (`web/components/qr/qr.constants.ts`).
#
# The one colourway that is not a canvas: it is the ink of the payment code's
# white well, and the mark has to be the SAME ink as the modules around it. Cream
# on that well is 1.3:1 and reads as two eyes with no head; the white pair has no
# contrast on white at all. Ink on white is 21.00:1 — the maximum a code can
# carry — so the mark and the modules are one colour, which is what makes a Seti
# code read as one object rather than a logo stuck on a QR code.
#
# It was cobalt `#494fdf` (6.06:1) while the plate wanted the brand accent. A code
# is a document read by a camera before it is a surface seen by a person, and the
# brand accent is not the thing to spend its contrast on.
CODE_INK = (0, 0, 0)


def _luma(rgb: np.ndarray) -> np.ndarray:
    return rgb.sum(axis=2) / 3.0


def _enclosed(img_l: Image.Image) -> np.ndarray:
    """Pixels inside the head but not painted: eyes and smile, as a bool mask.

    Flood fills from the four corners to label the outside, so an enclosed dark
    region is a feature of the mark rather than background.
    """
    head = (np.asarray(img_l) > 128).astype(np.uint8) * 255
    mask = Image.fromarray(head)
    w, h = mask.size
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(mask, seed, 128)
    return np.asarray(mask) == 0


def _head_box(mask: np.ndarray) -> tuple[int, int, int, int]:
    solid = mask if mask.dtype == bool else mask > 128
    ys, xs = np.nonzero(solid)
    if not len(xs):
        raise SystemExit("no mark found in that mask")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def _mouth_mask(size: tuple[int, int], neutral_box: tuple[int, int, int, int]) -> np.ndarray:
    """The smile, lifted from the 1254px icon and warped into the neutral's box.

    The eyes end at 0.729 of the head's height and the smile starts at 0.800, so
    the bottom of the enclosed features isolates the mouth without labelling
    components.
    """
    friendly = Image.open(FRIENDLY_SRC).convert("L")
    features = _enclosed(friendly)
    fbox = _head_box(np.asarray(friendly) > 128)
    y_cut = fbox[1] + int(round((fbox[3] - fbox[1]) * 0.76))
    smile = features.copy()
    smile[:y_cut] = False
    sx0, sy0, sx1, sy1 = _head_box(smile.astype(np.uint8) * 255)

    patch = Image.fromarray((smile[sy0:sy1, sx0:sx1] * 255).astype(np.uint8))

    nx0, ny0, nx1, ny1 = neutral_box
    scale_x = (nx1 - nx0) / (fbox[2] - fbox[0])
    scale_y = (ny1 - ny0) / (fbox[3] - fbox[1])
    tx = int(round(nx0 + (sx0 - fbox[0]) * scale_x))
    ty = int(round(ny0 + (sy0 - fbox[1]) * scale_y))
    tw = max(1, int(round((sx1 - sx0) * scale_x)))
    th = max(1, int(round((sy1 - sy0) * scale_y)))

    canvas = Image.new("L", size, 0)
    canvas.paste(patch.resize((tw, th), Image.Resampling.LANCZOS), (tx, ty))
    canvas = canvas.filter(ImageFilter.GaussianBlur(MINUSCULE))
    return np.asarray(canvas).astype(float) / 255.0


def _eye_mask(neutral: np.ndarray, head_luma: float) -> np.ndarray:
    """Soft mask of the black eyes: 1 inside, 0 on the head, feathered between.

    Derived from luminance so the eyes keep the source's own edge feather; a
    binary mask would ring them with a hard step.
    """
    luma = _luma(neutral[:, :, :3].astype(float))
    ink_luma = float(np.percentile(luma[neutral[:, :, 3] > 250], 1))
    strength = (head_luma - luma) / max(head_luma - ink_luma, 1.0)
    return np.clip((strength - 0.30) / 0.30, 0.0, 1.0)


def _shading(neutral: np.ndarray, head_luma: float, eye: np.ndarray) -> np.ndarray:
    """The source's 3D form as a 0..1.1 factor, so the mono marks are the same
    object in one colour rather than a flat sticker beside the cream one."""
    luma = _luma(neutral[:, :, :3].astype(float))
    shade = np.where(eye > 0.5, 1.0, luma / head_luma)
    return np.clip(shade, 0.0, 1.10)


def _compose(neutral: np.ndarray, eye: np.ndarray, mouth: np.ndarray | None,
             shade: np.ndarray, punch: bool, ink: tuple[int, int, int] = DARK_INK) -> Image.Image:
    """One mono mark: the body in ONE `ink`, features punched or painted.

    `punch` is a decision about what is BEHIND the mark, not about the colour: on a
    dark canvas (and inside the code's white well) the eyes are holes, so they take
    the surface's own colour and the mark reads on anything; on a light canvas the
    eyes are painted, because a hole in a cream head is a hole into the plate.
    """
    h, w = neutral.shape[:2]
    sil = neutral[:, :, 3].astype(float) / 255.0
    if punch:
        alpha = sil * (1.0 - eye)
        if mouth is not None:
            alpha = alpha * (1.0 - mouth)
        rgb = np.clip(np.array(ink, dtype=float) * shade[:, :, None], 0, 255)
    else:
        alpha = sil
        rgb = neutral[:, :, :3].astype(float)
        if mouth is not None:
            cover = mouth[:, :, None]
            rgb = rgb * (1 - cover) + np.array(MOUTH_INK, dtype=float) * cover
    out = np.zeros((h, w, 4), dtype=float)
    out[:, :, :3] = np.clip(rgb, 0, 255)
    out[:, :, 3] = np.clip(alpha * 255.0, 0, 255)
    return Image.fromarray(out.round().astype(np.uint8), "RGBA")


def _shared_canvas(img: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    pad = int(round((box[3] - box[1]) * OPTICAL_MARGIN))
    crop = img.crop((box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad))
    scale = CANVAS / crop.height
    crop = crop.resize((int(round(crop.width * scale)), CANVAS), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(crop, ((CANVAS - crop.width) // 2, (CANVAS - crop.height) // 2))
    return canvas


def _bare(mark: Image.Image, size: int) -> Image.Image:
    """The mark alone on a transparent canvas: what a browser TAB gets.

    No tile. The tab is chrome the mark does not own — a black square there reads
    as a thumbnail of the product rather than as its face, and it is the one place
    the alien is the whole of what a visitor sees. Transparent means the browser's
    own bar shows through, which is why the light and dark marks are both emitted
    and chosen by `prefers-color-scheme` in `app/layout.tsx`.
    """
    return mark.resize((size, size), Image.Resampling.LANCZOS)


def _tiled(mark: Image.Image, size: int) -> Image.Image:
    """The mark on black, for the HOME SCREEN, where a launcher composites it.

    Kept tiled on purpose: iOS and Android paint an icon on their own background
    and flatten transparency, so a "bare" home-screen icon is a black square with
    extra steps. At launcher sizes the tile is also what gives the white head an
    edge. RGBA, not RGB, because the ICO encoder rejects a frame with no alpha.
    """
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    inset = int(round(size * 0.19))
    glyph = mark.resize((size - 2 * inset, size - 2 * inset), Image.Resampling.LANCZOS)
    tile.alpha_composite(glyph, (inset, inset))
    return tile


def main() -> None:
    neutral = np.asarray(Image.open(NEUTRAL_SRC).convert("RGBA"))
    opaque = neutral[:, :, 3] > 250
    head_luma = float(np.median(_luma(neutral[:, :, :3].astype(float))[opaque]))

    eye = _eye_mask(neutral, head_luma)
    shade = _shading(neutral, head_luma, eye)
    mouth = _mouth_mask(neutral.shape[:2][::-1], _head_box(neutral[:, :, 3]))

    built = {
        "seti-mark-neutral.png": _compose(neutral, eye, None, shade, punch=False),
        "seti-mark-friendly.png": _compose(neutral, eye, mouth, shade, punch=False),
        "seti-mark-neutral-dark.png": _compose(neutral, eye, None, shade, punch=True),
        "seti-mark-friendly-dark.png": _compose(neutral, eye, mouth, shade, punch=True),
        "seti-mark-neutral-code.png": _compose(neutral, eye, None, shade, punch=True, ink=CODE_INK),
        "seti-mark-friendly-code.png": _compose(neutral, eye, mouth, shade, punch=True, ink=CODE_INK),
    }

    boxes = [_head_box(np.asarray(img)[:, :, 3]) for img in built.values()]
    if not boxes:
        raise SystemExit("nothing rendered")
    box = (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )

    marks: dict[str, Image.Image] = {}
    for name, img in built.items():
        marks[name] = _shared_canvas(img, box)
        marks[name].save(HERE / name, optimize=True)
        print(f"{name}  {CANVAS}x{CANVAS}")

    light = marks["seti-mark-neutral.png"]
    dark = marks["seti-mark-neutral-dark.png"]

    # The tab: bare, no tile, and ONE colourway on every browser scheme.
    #
    # The owner's call: the white mark in both light and dark bars, so the tab is
    # the same object everywhere rather than a face that changes colour with the
    # OS. Its cost is measured and accepted: white on Chrome's light tab bar
    # `#dee1e6` is 1.35:1, so on a light bar the mark is a silhouette you read by
    # shape rather than by edge, and its eyes are the only dark thing in it. Cream
    # was 1.3:1 on the same bar, so the alternative was not better — only
    # different.
    tab = {"favicon.png": _bare(dark, 64)}
    for name, img in tab.items():
        img.save(HERE / name, optimize=True)
        print(f"{name}  {img.size[0]}x{img.size[1]}")

    # Legacy fallback for a client that only ever asks for /favicon.ico.
    favicon = HERE / "favicon.ico"
    _bare(dark, 64).save(favicon, sizes=[(16, 16), (32, 32), (48, 48)])
    print("favicon.ico  16/32/48  bare")

    # The home screen: tiled, because a launcher paints one.
    icons = {
        "icon.png": _tiled(dark, 512),
        "apple-icon.png": _tiled(dark, 180),
    }
    for name, img in icons.items():
        img.save(HERE / name, optimize=True)
        print(f"{name}  {img.size[0]}x{img.size[1]}")

    if "--install" in sys.argv:
        for name, img in marks.items():
            shutil.copy2(HERE / name, REPO / "web" / "public" / name)
        for name in (*tab, "favicon.ico"):
            shutil.copy2(HERE / name, REPO / "web" / "public" / name)
        shutil.copy2(HERE / "apple-icon.png", REPO / "web" / "app" / "apple-icon.png")
        print("installed into web/public and web/app")


if __name__ == "__main__":
    main()
