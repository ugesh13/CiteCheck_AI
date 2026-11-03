import os, re

keys = set()
for root, dirs, files in os.walk('Frontend/Glassmorphic-Frontend-Builder/artifacts/citecheck-ai/src'):
    for f in files:
        if f.endswith(('.ts', '.tsx')):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8') as fl:
                c = fl.read()
            for m in re.finditer(r'localStorage\.(?:getItem|setItem|removeItem)\([\'"]([^\'"]+)[\'"]', c):
                keys.add(m.group(1))

print('Frontend localStorage keys:', sorted(list(keys)))

