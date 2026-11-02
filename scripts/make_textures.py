#!/usr/bin/env python3
"""生成占位贴图（32x32 / icon 128x128）。零依赖，纯 zlib 手写 PNG。

用法：python3 scripts/make_textures.py
产物：
  content/Content/Items/Accessories/WarriorGrowthCharm.png
  content/Content/Items/Accessories/AwakenedWarriorGrowthCharm.png
  icon.png
换图：直接用画好的 PNG 覆盖同名文件即可（保持 32x32）。
"""
import struct, zlib, os

def png(path, w, h, pixels):
    rows = []
    for y in range(h):
        row = bytearray(b'\x00')
        for x in range(w):
            row.extend(pixels[y][x])
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    data = (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(data)

def shield(accent, gem, glow=False):
    """画一个 32x32 的盾牌：金色描边 + 主色盾面 + 宝石。"""
    W = H = 32
    px = [[(0, 0, 0, 0) for _ in range(W)] for _ in range(H)]
    for y in range(H):
        for x in range(W):
            # 盾形：上半矩形 + 下半收窄
            top, bottom = 3, 29
            if y < 3 or y > 29:
                continue
            half = 13 if y <= 14 else 13 - int((y - 14) * 0.75)
            cx = 16
            if abs(x - cx) > half:
                continue
            edge = abs(x - cx) > half - 2 or y < 5 or y > 27
            if edge:
                px[y][x] = accent
            else:
                px[y][x] = (60, 32, 40, 255) if not glow else (18, 40, 60, 255)
    # 宝石：菱形
    for dy in range(-4, 5):
        span = 4 - abs(dy)
        for dx in range(-span, span + 1):
            x, y = 16 + dx, 15 + dy
            if 0 <= x < W and 0 <= y < H:
                px[y][x] = gem
    return px

def upscale(px, factor):
    out = []
    for row in px:
        newrow = []
        for p in row:
            newrow.extend([p] * factor)
        for _ in range(factor):
            out.append(list(newrow))
    return out

os.makedirs('content/Content/Items/Accessories', exist_ok=True)
base = shield((224, 176, 74, 255), (200, 60, 60, 255))
awak = shield((120, 220, 255, 255), (140, 90, 255, 255), glow=True)
png('content/Content/Items/Accessories/WarriorGrowthCharm.png', 32, 32, base)
png('content/Content/Items/Accessories/AwakenedWarriorGrowthCharm.png', 32, 32, awak)
png('icon.png', 128, 128, upscale(base, 4))
print('textures written')
