from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
OUT = Path(__file__).resolve().parents[1] / "assets" / "ma-app-icon.png"


def font(size: int):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


def main():
    image = Image.new("RGB", (SIZE, SIZE), "#101617")
    draw = ImageDraw.Draw(image)

    # Warm rounded border inspired by the approved Melanated camping mark.
    draw.rounded_rectangle((46, 46, 978, 978), radius=150, outline="#F0A62A", width=26)
    draw.rounded_rectangle((72, 72, 952, 952), radius=135, outline="#E65B16", width=10)

    # Sunset disc and horizontal bands.
    draw.ellipse((270, 126, 754, 610), fill="#F6B52E")
    bands = ["#F6B52E", "#F08B20", "#EB5D16", "#D94315"]
    for idx, color in enumerate(bands):
        y0 = 250 + idx * 54
        draw.rectangle((270, y0, 754, y0 + 32), fill=color)

    # Mountains, kept bold so the mark reads at launcher size.
    draw.polygon([(118, 520), (330, 320), (445, 430), (568, 250), (870, 526)], fill="#1A2020")
    draw.polygon([(210, 520), (333, 371), (382, 430), (332, 400)], fill="#F4D58A")
    draw.polygon([(425, 438), (568, 300), (642, 392), (568, 346)], fill="#F7E2A9")
    draw.polygon([(655, 455), (742, 360), (830, 458), (742, 405)], fill="#E8C16E")

    # Forest silhouette.
    tree_color = "#53652E"
    for x, y, scale in [(180, 470, 1.0), (250, 500, .78), (720, 480, .95), (800, 500, .82), (650, 510, .72)]:
        trunk_w = int(18 * scale)
        draw.rectangle((x - trunk_w // 2, y + int(88 * scale), x + trunk_w // 2, y + int(145 * scale)), fill="#242A20")
        draw.polygon([(x, y), (x - int(60 * scale), y + int(100 * scale)), (x + int(60 * scale), y + int(100 * scale))], fill=tree_color)
        draw.polygon([(x, y + int(50 * scale)), (x - int(72 * scale), y + int(135 * scale)), (x + int(72 * scale), y + int(135 * scale))], fill=tree_color)

    # Tent.
    draw.polygon([(294, 708), (478, 520), (642, 708)], fill="#E6A83A")
    draw.polygon([(478, 520), (478, 708), (642, 708)], fill="#F1C15F")
    draw.polygon([(430, 708), (478, 610), (528, 708)], fill="#121718")
    draw.line((478, 520, 478, 708), fill="#FFF0BD", width=12)

    # Campfire.
    draw.ellipse((624, 700, 790, 748), fill="#6B4023")
    draw.line((650, 735, 760, 780), fill="#8A552C", width=30)
    draw.line((760, 735, 650, 780), fill="#8A552C", width=30)
    draw.polygon([(705, 730), (658, 686), (690, 610), (716, 660), (752, 590), (776, 674), (748, 730)], fill="#F04A16")
    draw.polygon([(710, 722), (688, 682), (714, 640), (742, 686), (733, 722)], fill="#FFD34A")

    # Brand name. Large, simple, high-contrast.
    label = "MELANATED"
    label_font = font(108)
    bbox = draw.textbbox((0, 0), label, font=label_font)
    label_w = bbox[2] - bbox[0]
    draw.text(((SIZE - label_w) / 2, 812), label, font=label_font, fill="#F6E1A7")

    # Bottom star detail.
    draw.line((310, 944, 450, 944), fill="#E85B18", width=10)
    draw.line((574, 944, 714, 944), fill="#E85B18", width=10)
    draw.polygon([(512, 916), (524, 940), (548, 952), (524, 964), (512, 988), (500, 964), (476, 952), (500, 940)], fill="#E85B18")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT, "PNG", optimize=False, compress_level=6)

    with Image.open(OUT) as check:
        if check.format != "PNG" or check.size != (SIZE, SIZE):
            raise RuntimeError("Generated app icon failed validation")
        check.verify()

    print(f"Generated valid Melanated app icon: {OUT} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
