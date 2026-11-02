#!/usr/bin/env python3
"""把本仓库打成可直接安装的 .bl（就是 ZIP，根目录 manifest.json + content/）。

用法：
    python3 scripts/build_bl.py

产物：
    dist/WarriorGrowthCharm-<version>.bl

结构（与官方 mod 仓库里的 .bl 一致）：
    manifest.json
    icon.png
    description.md
    content/main.js
    content/Common/**            （Config / Progress / Stats / Players）
    content/Content/Items/...    （ModItem + 同名 .png 贴图）
"""

import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCLUDE_FILES = ['manifest.json', 'icon.png', 'description.md']
INCLUDE_DIRS = ['content']
EXCLUDE_EXT = {'.md'}  # content/ 下的 md 不打进去（约定上模组内不放文档）


def collect():
    files = []
    for name in INCLUDE_FILES:
        path = os.path.join(ROOT, name)
        if os.path.isfile(path):
            files.append((path, name))
        elif name == 'manifest.json':
            sys.exit('缺少 manifest.json')
    for d in INCLUDE_DIRS:
        base = os.path.join(ROOT, d)
        for dirpath, _, filenames in os.walk(base):
            for fn in sorted(filenames):
                if os.path.splitext(fn)[1].lower() in EXCLUDE_EXT:
                    continue
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, ROOT).replace(os.sep, '/')
                files.append((full, rel))
    return files


def main():
    with open(os.path.join(ROOT, 'manifest.json'), encoding='utf-8') as f:
        manifest = json.load(f)
    version = manifest.get('version', '0.0.0')
    out_dir = os.path.join(ROOT, 'dist')
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"WarriorGrowthCharm-{version}.bl")

    files = collect()
    # 只有物品（content/Content/Items/**.js）才要求同目录同名 .png
    missing_textures = [
        rel
        for full, rel in files
        if rel.endswith('.js')
        and '/Content/Items/' in rel
        and not os.path.isfile(full[:-3] + '.png')
    ]
    if missing_textures:
        print('⚠️ 下面这些 .js 没有同名 .png（物品会加载失败）：')
        for m in missing_textures:
            print('   -', m)
        sys.exit(1)

    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for full, rel in files:
            z.write(full, rel)

    size = os.path.getsize(out)
    print(f'✅ {out}  ({size} bytes, {len(files)} 个文件)')
    for _, rel in files:
        print('   -', rel)


if __name__ == '__main__':
    main()