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

The one file here that is not a 384 canvas is the lockup: the head and the
wordmark as one drawn object, 308x112, which now ships in two expressions because
the chrome wears the friendly face. Its twin is built from the same mark, so the
smile in it is the mark's smile and not a second drawing of one.
"""

from pathlib import Path
import math
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

# THE LOCKUP, AND ITS FRIENDLY TWIN
#
# `seti-lockup.png` is the head and the wordmark as ONE drawn object — 308x112,
# ink #f5f5f5, transparent — and it is what the navbar draws. It is the one
# supplied artwork with no copy of its own in this folder: the file the app serves
# is the only one on disk. So its twin is built from that copy and written back
# beside it in the same pass, on every run rather than only on --install, because
# a rebuild that changed the artwork and not what the chrome shows is the one
# failure this pair cannot afford.
LOCKUP = REPO / "web" / "public" / "seti-lockup.png"
LOCKUP_FRIENDLY = "seti-lockup-friendly.png"
# The smile is a 1-2px stroke in the 384 mark and arrives 2.99x smaller in the
# lockup, where an area average of that stroke tops out well below full coverage.
# Measured: the mark's hole is 403px, which is 45px at the lockup's scale, and an
# honest average punches 10 of them — a smile of alpha ~40 beside two eyes at
# alpha 0, which is a grey line and not a hole. This gain puts the stroke's own
# core back (38 of the 45) without widening it: the support stays 64px.
SMILE_GAIN = 1.3


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


def _taken(img_l: Image.Image) -> np.ndarray:
    """Pixels inside the ink but not painted: the eyes, and a friendly mark's smile.

    The same test `_enclosed` above performs, on a COPY of the mask, because it
    has to be the same test and it cannot be the same function: `Image.fromarray`
    hands back a read-only image on this Pillow, `ImageDraw.floodfill` writes to a
    private copy and drops it, and the fill no-ops — after which every pixel that
    is not ink reads as "enclosed". Measured on the 1254px icon the two answers
    are 1,216,881px and 95,677px, so this one is measured rather than assumed.
    """
    mask = Image.fromarray((np.asarray(img_l) > 128).astype(np.uint8) * 255, mode="L").copy()
    w, h = mask.size
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(mask, seed, 128)
    return np.asarray(mask) == 0


def _regions(mask: np.ndarray) -> list[np.ndarray]:
    """Each enclosed region on its own, largest first: two eyes, then a smile.

    Flood-fill labelling rather than scipy, for the same reason the rest of this
    file is numpy and PIL and nothing else, and because a mark has three of these
    at most.
    """
    todo = mask.copy()
    found: list[np.ndarray] = []
    while todo.any():
        ys, xs = np.nonzero(todo)
        label = Image.fromarray(todo.astype(np.uint8) * 255, mode="L").copy()
        ImageDraw.floodfill(label, (int(xs[0]), int(ys[0])), 128)
        region = np.asarray(label) == 128
        found.append(region)
        todo &= ~region
    return sorted(found, key=lambda r: -int(r.sum()))


def _centroid(region: np.ndarray) -> tuple[float, float]:
    ys, xs = np.nonzero(region)
    return float(xs.mean()), float(ys.mean())


def _eyes(img_l: Image.Image) -> list[tuple[float, float]]:
    """The two eye centroids, left to right.

    Size alone separates them. The lockup's only other enclosed region is a 213px
    counter inside the `e` — a third of a pupil — and the mark's third region is
    the smile at 403px against 7,420 and 7,452.
    """
    pair = [_centroid(r) for r in _regions(_taken(img_l))[:2]]
    return sorted(pair, key=lambda p: p[0])


def _eye_fit(src: list[tuple[float, float]], dst: list[tuple[float, float]]) -> tuple[float, float, float]:
    """One scale and one translation: the source's eye pair onto the destination's.

    No rotation, and no second scale. The eye pair is the only place these two
    files state the same measurement, and a non-uniform fit is what turns a
    transferred smile into a smirk.
    """
    span = math.dist(src[1], src[0])
    if not span:
        raise SystemExit("no eye pair to fit on")
    scale = math.dist(dst[1], dst[0]) / span
    tx = (dst[0][0] + dst[1][0]) / 2 - scale * (src[0][0] + src[1][0]) / 2
    ty = (dst[0][1] + dst[1][1]) / 2 - scale * (src[0][1] + src[1][1]) / 2
    return scale, tx, ty


def _warp(mask: np.ndarray, size: tuple[int, int], scale: float, tx: float, ty: float) -> np.ndarray:
    """Resample `mask` by one uniform scale and a translation, in float.

    The half-pixel terms are pixel CENTRES: PIL maps an output pixel's index back
    to a source index, so the affine has to carry the 0.5 in and take it out
    again, or a 2.99x reduction lands the face a third of a pixel off the eyes it
    was fitted to.
    """
    source = Image.fromarray(mask.astype(np.float32), mode="F")
    affine = (1.0 / scale, 0.0, (0.5 - tx) / scale - 0.5, 0.0, 1.0 / scale, (0.5 - ty) / scale - 0.5)
    warped = source.transform(size, Image.AFFINE, affine, resample=Image.BICUBIC)
    return np.clip(np.asarray(warped), 0.0, 1.0)


def _head_mask(alpha: np.ndarray) -> np.ndarray:
    """The head as one region of ink, found from its own leftmost pixel.

    Flood-fill on the INK rather than on the holes: the head is one region however
    many features are punched into it, and the wordmark beside it stays out because
    the two never touch.
    """
    ink = Image.fromarray(((alpha > 128) * 255).astype(np.uint8), mode="L").copy()
    ys, xs = np.nonzero(np.asarray(ink))
    ImageDraw.floodfill(ink, (int(xs.min()), int(ys[np.argmin(xs)])), 128)
    return np.asarray(ink) == 128


def _lockup_friendly(lockup: Image.Image, mark: Image.Image) -> Image.Image:
    """The lockup with the friendly face, and why its head is not pasted in.

    The two files are the same head drawn at different proportions. Measured on
    the punched eyes and the solid head (alpha > 128):

        lockup head   96 x 106   aspect 0.906   eyes 45.30px apart
        mark head    276 x 356   aspect 0.775   eyes 135.42px apart

    so the two axes disagree by 16.8%: 0.3478 across, 0.2978 down, and no single
    scale can land both. Fitted on the eyes — the face's one reliable anchor —
    the mark's head maps to 93 x 112 at (4, 0): six pixels taller than the
    lockup's own 106 and running off the canvas, so it overflows the neutral
    outline at the top and the bottom. Pulling it back inside is the 16.8% squash
    that turns a smile into a smirk; pasting it and clipping it to the lockup's
    silhouette leaves the layer's own feathered edge inside the head as a seam.
    The size of that seam is measurable: the NEUTRAL mark pasted the same way
    differs from the lockup's own head by mean 3.1 and p95 13.5 levels of tone,
    which is registration drift and not expression.

    So only the expression is transferred. The friendly and neutral marks differ
    in 1,736 pixels, all of them in the lower face — the eyes are identical, and
    the smile is the whole of what the expression adds. Punching that through the
    lockup's own pixels gives the friendly face with the neutral outline intact:
    every pixel outside the smile is byte-identical to the supplied file, the head
    keeps the lockup's ink by construction rather than by a colour match, and the
    head's box, aspect and eye centroids cannot move because nothing that draws
    them was rewritten.
    """
    lock = np.asarray(lockup.convert("RGBA"))
    face = np.asarray(mark.convert("RGBA"))
    mark_l = Image.fromarray(face[:, :, 3], mode="L").copy()
    lock_l = Image.fromarray(lock[:, :, 3], mode="L").copy()

    regions = _regions(_taken(mark_l))
    if len(regions) < 3:
        raise SystemExit("that mark carries no mouth to transfer")
    scale, tx, ty = _eye_fit(_eyes(mark_l), _eyes(lock_l))

    # The punch the mark itself carries, so the smile keeps the source's own edge
    # feather instead of acquiring this script's. Kept to the smile's own
    # neighbourhood: the mark also carries a few hundred pixels of 1-2/255 rim
    # around the chin, left by the mouth transfer that built it, and a 2% punch
    # spread over a wide band is a grey patch on a black navbar.
    punch = np.clip((255.0 - face[:, :, 3]) / 255.0, 0.0, 1.0)
    punch *= (face[:, :, 3] > 128) | _taken(mark_l)
    near = Image.fromarray((regions[2] * 255).astype(np.uint8), mode="L").filter(ImageFilter.MaxFilter(5))
    punch *= np.asarray(near) > 0

    punch = np.clip(_warp(punch, lockup.size, scale, tx, ty) * SMILE_GAIN, 0.0, 1.0)

    # A smile that reaches the outline opens the silhouette and the head stops
    # reading as one object, so the punch is confined to the head's interior.
    interior = np.asarray(
        Image.fromarray(((lock[:, :, 3] > 128) * 255).astype(np.uint8), mode="L").filter(ImageFilter.MinFilter(5))
    ) > 0
    if not interior[punch >= 1.0 / 255.0].all():
        raise SystemExit("the smile reaches the lockup's outline")

    out = lock.copy()
    alpha = np.round(lock[:, :, 3] * (1.0 - punch)).astype(np.uint8)
    out[:, :, 3] = alpha
    # A hole carries no ink: the supplied lockup's own eye holes are rgb 0 under
    # alpha 0, and the new ones are made to match, so the face has one hole
    # treatment and not two.
    out[(alpha == 0) & (lock[:, :, 3] > 0)] = 0

    # The claim, checked at build time rather than in a review: nothing outside
    # the head moves, and the head is the same box it was.
    head = _head_mask(lock[:, :, 3])
    box = _head_box(head)
    outside = np.ones(lock.shape[:2], dtype=bool)
    outside[box[1]:box[3], box[0]:box[2]] = False
    if not (out[outside] == lock[outside]).all():
        raise SystemExit("the lockup changed outside the head box")
    if _head_box(_head_mask(out[:, :, 3])) != box:
        raise SystemExit("the head's box moved")

    return Image.fromarray(out, "RGBA")


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

    # The lockup, worn with the friendly face. Built last because the face it
    # wears is the friendly dark mark, written a few lines above; installed in
    # both homes in one pass, because the served copy is where its source lives.
    lockup = _lockup_friendly(Image.open(LOCKUP).convert("RGBA"), marks["seti-mark-friendly-dark.png"])
    lockup.save(HERE / LOCKUP_FRIENDLY, optimize=True)
    shutil.copy2(HERE / LOCKUP_FRIENDLY, LOCKUP.with_name(LOCKUP_FRIENDLY))
    print(f"{LOCKUP_FRIENDLY}  {lockup.size[0]}x{lockup.size[1]}")

    if "--install" in sys.argv:
        for name, img in marks.items():
            shutil.copy2(HERE / name, REPO / "web" / "public" / name)
        for name in (*tab, "favicon.ico"):
            shutil.copy2(HERE / name, REPO / "web" / "public" / name)
        shutil.copy2(HERE / "apple-icon.png", REPO / "web" / "app" / "apple-icon.png")
        print("installed into web/public and web/app")


if __name__ == "__main__":
    main()
