"""Generate PNG/ICO favicons from the brand logo in public/."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
LOGO = PUBLIC / "lifepath logo.png"


def _fit_square(img: Image.Image, size: int) -> Image.Image:
    img = img.convert("RGBA")
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    cropped = img.crop((left, top, left + side, top + side))
    return cropped.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    if not LOGO.exists():
        raise SystemExit(f"Logo not found: {LOGO}")

    logo = Image.open(LOGO)
    png32 = _fit_square(logo, 32)
    png32.save(PUBLIC / "favicon.png")

    _fit_square(logo, 180).save(PUBLIC / "apple-touch-icon.png")

    ico_images = [_fit_square(logo, s) for s in (16, 32, 48)]
    ico_images[0].save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=ico_images[1:],
    )

    # Optional crisp SVG fallback points at PNG (browsers prefer PNG/ICO for tabs).
    print(f"Wrote favicons from {LOGO.name} to {PUBLIC}")


if __name__ == "__main__":
    main()
