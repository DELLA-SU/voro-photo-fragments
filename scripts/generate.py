from PIL import Image
from pathlib import Path
import random, subprocess, json
root=Path(__file__).resolve().parents[1]
im=Image.open(root/'dist/reference.jpeg').convert('RGB')
levels=[]
for count in [10,20,50,100,400,1600,6400,14400]:
    random.seed(413)
    points=[]; colors=[]
    if count<=100:
        # Every seed belongs to the photographed subject, so even ten cells
        # cut the character itself instead of partitioning its empty margins.
        while len(points)<count:
            x=random.uniform(140,600); y=random.uniform(165,560)
            rgb=im.getpixel((int(x),int(y)))
            if min(rgb)>235: continue
            points.append(f'{len(points)} {x} {y}'); colors.append(rgb)
    else:
        grid=int(count**.5)
        for j in range(grid):
            for i in range(grid):
                x=(i+.5+random.uniform(-.42,.42))*736/grid
                y=(j+.5+random.uniform(-.42,.42))*737/grid
                points.append(f'{len(points)} {x} {y}')
                colors.append(im.getpixel((min(735,int(x)),min(736,int(y)))))
    out=subprocess.check_output([str(root/'scripts/cells')],input='\n'.join(points).encode())
    raw=json.loads(out)
    cells=[[colors[i],poly] for i,poly in raw]
    assert len(cells)==count
    levels.append({'seeds':count,'cells':cells})
    print(count,len(cells))
(root/'dist/cells.json').write_text(json.dumps(levels,separators=(',',':')))
