"""
Sync built frontend artifacts from dist/public to public/ and root index.html.
This ensures Vercel and production deployments always serve the freshly compiled bundle.
"""

import os
import shutil

src_dir = os.path.abspath('Frontend/Glassmorphic-Frontend-Builder/artifacts/citecheck-ai/dist/public')
public_dir = os.path.abspath('public')
root_index = os.path.abspath('index.html')

if not os.path.exists(src_dir):
    print(f"Error: {src_dir} does not exist. Run pnpm build first.")
    exit(1)

# Clean old public/assets
public_assets = os.path.join(public_dir, 'assets')
if os.path.exists(public_assets):
    shutil.rmtree(public_assets)

# Copy all files from src_dir to public_dir
for item in os.listdir(src_dir):
    s = os.path.join(src_dir, item)
    d = os.path.join(public_dir, item)
    if os.path.isdir(s):
        shutil.copytree(s, d)
    else:
        shutil.copy2(s, d)

# Copy index.html to root index.html
src_index = os.path.join(src_dir, 'index.html')
if os.path.exists(src_index):
    shutil.copy2(src_index, root_index)

print(f"Successfully synced dist/public -> public/ and root index.html")
