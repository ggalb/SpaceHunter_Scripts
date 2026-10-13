# Crops Georg's screenshots to the dialog: removes the dark grey desktop
# border. A pixel counts as desktop if it is dark (luminance < 115) and grey
# (channels within 18 of each other). Reads ../Images, writes images/.
import os, sys
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'Images')
DST = os.path.join(os.path.dirname(__file__), 'images')
SKIP = {'Part1_PixelMath_4.png'}   # tooltip close-up: the desktop is part of it
# Extra (top, bottom) rows to cut after the automatic trim, where light window
# edges above/below the dialog are not dark desktop (checked by eye).
EXTRA = {'Part2_3.png': (13, 0), 'Part2_1.png': (15, 17)}

def is_desktop(p):
    r, g, b = p[:3]
    return (0.299 * r + 0.587 * g + 0.114 * b) < 115 and max(r, g, b) - min(r, g, b) < 18

def content_box(im):
    rgb = im.convert('RGB')
    w, h = rgb.size
    px = rgb.load()
    # a row/column is content if > 40% of its pixels are not desktop (ignores thin strips of other windows)
    def row_has(y):
        return sum(not is_desktop(px[x, y]) for x in range(0, w, 2)) > 0.40 * w / 2
    def col_has(x):
        return sum(not is_desktop(px[x, y]) for y in range(0, h, 2)) > 0.40 * h / 2
    top = next(y for y in range(h) if row_has(y))
    bottom = next(y for y in range(h - 1, -1, -1) if row_has(y)) + 1
    left = next(x for x in range(w) if col_has(x))
    right = next(x for x in range(w - 1, -1, -1) if col_has(x)) + 1
    return left, top, right, bottom

for name in sorted(os.listdir(SRC)):
    # Screenshot*.png are Georg's reference shots, not manual images
    if not name.lower().endswith('.png') or name.startswith('Screenshot'):
        continue
    im = Image.open(os.path.join(SRC, name))
    if name in SKIP:
        box = (0, 0) + im.size
    else:
        box = content_box(im)
    if name in EXTRA:
        t, b = EXTRA[name]
        box = (box[0], box[1] + t, box[2], box[3] - b)
    im.crop(box).save(os.path.join(DST, name))
    print('%-26s %s -> %s' % (name, im.size, (box[2] - box[0], box[3] - box[1])))
