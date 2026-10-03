# measure-corner-art.py —— 测量侧栏角落装饰素材里金线的位置与粗细
#
# 目的:皮肤用"角落贴图 + CSS 直线段"拼出侧栏金框,两边的线如果不在同一条坐标上,
# 就会看到"角上的线和直的金线对不齐"。本工具量出贴图里金线的真实位置/粗细,
# 供 CSS 的 offset / 线宽取值使用。
from PIL import Image
import sys

path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\11488\code\dsh-deep-whale\maid-atelier\assets\maid-sidebar-corner-v1.webp"
im = Image.open(path).convert("RGBA")
W, H = im.size
px = im.load()
print(f"素材尺寸 {W}x{H}")

# 金色判定:暖色且不太透明(金线 = 高 R、中 G、低 B,alpha 较高)
def is_gold(c):
    r, g, b, a = c
    return a > 120 and r > 150 and g > 110 and b < 190 and r - b > 40

# 1) 纵向金线:在若干行上找金线像素的 x 区间
print("--- 纵向金线(每行首个金线像素带)")
for y in range(0, H, max(1, H // 12)):
    xs = [x for x in range(W) if is_gold(px[x, y])]
    if xs:
        runs = []
        start = xs[0]
        prev = xs[0]
        for x in xs[1:]:
            if x != prev + 1:
                runs.append((start, prev))
                start = x
            prev = x
        runs.append((start, prev))
        print(f"    y={y}: {runs[:4]}")

# 2) 横向金线:在若干列上找金线像素的 y 区间
print("--- 横向金线(每列首个金线像素带)")
for x in range(0, W, max(1, W // 12)):
    ys = [y for y in range(H) if is_gold(px[x, y])]
    if ys:
        runs = []
        start = ys[0]
        prev = ys[0]
        for y in ys[1:]:
            if y != prev + 1:
                runs.append((start, prev))
                start = y
            prev = y
        runs.append((start, prev))
        print(f"    x={x}: {runs[:4]}")

# 3) 不透明区域的包围盒(实际绘制范围)
xs = []
ys = []
for y in range(H):
    for x in range(W):
        if px[x, y][3] > 20:
            xs.append(x)
            ys.append(y)
if xs:
    print(f"--- 不透明包围盒: x {min(xs)}..{max(xs)}  y {min(ys)}..{max(ys)}")
