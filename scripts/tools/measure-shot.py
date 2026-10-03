# measure-shot.py —— 界面截图像素测量工具(可复用)
#
# 用途:主人报"有间距/没间距/贴边/色差"这类主观描述时,用截图做客观测量:
#   ① 找纯色区块(白卡)的边界;② 沿某行/某列找所有颜色突变点(元素边缘);
#   ③ 给出元素之间的像素距离,换算 CSS 像素(需要已知的参照物宽度,如导航列 188px)。
#
# 用法:
#   python measure-shot.py <截图.png> [--row 300] [--col 700] [--white 250] [--from 300]
#   --row y    水平扫描线(打印该行所有颜色突变点)
#   --col x    垂直扫描线
#   --white N  纯色阈值(默认 250,判定"白卡");决定白区边界时会用到
#   --from x   扫描起点(跳开窗口左侧的立绘/背景,默认 300)
#
# 经验:先挑一条穿过目标元素的扫描线,再读突变点;测量时务必用**已知参照物**
# (导航列 188px、面板宽 960px)换算比例,否则图像缩放会给出错误结论。
import sys
from PIL import Image


def parse_args(argv):
    path = argv[1] if len(argv) > 1 else None
    opts = {'row': None, 'col': None, 'white': 250, 'from': 300}
    i = 2
    while i < len(argv):
        key = argv[i].lstrip('-')
        if key in opts and i + 1 < len(argv):
            opts[key] = int(argv[i + 1])
            i += 2
        else:
            i += 1
    return path, opts


def main():
    path, opts = parse_args(sys.argv)
    if path is None:
        print(__doc__ or 'usage: python measure-shot.py <png>')
        return
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()
    print(f'图像 {w}x{h}')

    row = opts['row']
    if row is not None and 0 <= row < h:
        print(f'--- 水平扫描 y={row}（起点 x={opts["from"]}）')
        prev = px[opts['from'], row]
        for x in range(opts['from'] + 1, w):
            c = px[x, row]
            if max(abs(c[i] - prev[i]) for i in range(3)) > 5:
                print(f'    x={x}  {prev} -> {c}')
            prev = c

    col = opts['col']
    if col is not None and 0 <= col < w:
        print(f'--- 垂直扫描 x={col}')
        prev = px[col, 0]
        for y in range(1, h):
            c = px[col, y]
            if max(abs(c[i] - prev[i]) for i in range(3)) > 5:
                print(f'    y={y}  {prev} -> {c}')
            prev = c

    # 纯色区块(白卡)边界:取覆盖面积最大的连续近白水平段
    thr = opts['white']
    best_rows = []
    for y in range(h):
        start = None
        row_best = None
        for x in range(w):
            near_white = all(v >= thr for v in px[x, y])
            if near_white and start is None:
                start = x
            elif not near_white and start is not None:
                if row_best is None or x - start > row_best[1] - row_best[0]:
                    row_best = (start, x - 1)
                start = None
        if row_best is not None and row_best[1] - row_best[0] > 200:
            best_rows.append((y, row_best[0], row_best[1]))
    if best_rows:
        ys = [r[0] for r in best_rows]
        xs0 = min(r[1] for r in best_rows)
        xs1 = max(r[2] for r in best_rows)
        mid = best_rows[len(best_rows) // 2]
        print(f'--- 近白区块（阈值 {thr}）')
        print(f'    y 范围 {min(ys)}..{max(ys)}；x 范围 {xs0}..{xs1}')
        print(f'    中间行 y={mid[0]}: x {mid[1]}..{mid[2]}（宽 {mid[2] - mid[1] + 1}）')
        print('    换算提示：用已知参照物（导航列 188px / 面板 960px）求比例后再折算 CSS 像素。')
    else:
        print(f'--- 未找到近白区块（可降低 --white 阈值重试）')


if __name__ == '__main__':
    main()
