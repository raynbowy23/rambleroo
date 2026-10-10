"""Opaque triangle rasterizer: barycentric depth, flat pigment lighting, 2x AA."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

source, destination = sys.argv[1:]
data = json.loads(Path(source).read_text())
out = Path(destination)
thumbs = []
for item in data['images']:
    scale = 2
    w, h = item['width'] * scale, item['height'] * scale
    pixels = np.full((h, w, 3), [246, 234, 211], dtype=np.uint8)
    depth = np.full((h, w), np.inf)
    layer = 0
    for triangle in item['triangles']:
        if triangle['layer'] != layer:
            depth.fill(np.inf)
            layer = triangle['layer']
        vertices = np.array(triangle['vertices'])
        vertices[:, :2] *= scale
        x0, y0 = np.maximum(0, np.floor(vertices[:, :2].min(axis=0)).astype(int))
        x1, y1 = np.minimum([w-1, h-1], np.ceil(vertices[:, :2].max(axis=0)).astype(int))
        if x1 < x0 or y1 < y0:
            continue
        a, b, c = vertices
        denominator = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(denominator) < 1e-9:
            continue
        yy, xx = np.mgrid[y0:y1+1, x0:x1+1] + .5
        u = ((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/denominator
        v = ((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/denominator
        z = u*a[2]+v*b[2]+(1-u-v)*c[2]
        visible = (u >= 0) & (v >= 0) & (u+v <= 1)
        old = depth[y0:y1+1, x0:x1+1]
        if triangle['depth']:
            visible &= z < old
            old[visible] = z[visible]
        pixels[y0:y1+1, x0:x1+1][visible] = triangle['color']
    image = Image.fromarray(pixels).resize((item['width'],item['height']),Image.Resampling.LANCZOS)
    image.save(out / (item['name']+'.png'))
    if item['name'] != 'miniature':
        thumbs.append((item['name'],image))
sheet = Image.new('RGB',(1440,396*((len(thumbs)+2)//3)),(246,234,211))
draw = ImageDraw.Draw(sheet)
for i,(name,image) in enumerate(thumbs):
    x,y = (i%3)*480,(i//3)*396
    draw.text((x+14,y+12),data['phase']+' / '+name,fill='#252b22')
    sheet.paste(image,(x,y+36))
sheet.save(out/'contact-sheet.png')
# Intermediate triangles are large and are not an owner deliverable.
Path(source).unlink()
