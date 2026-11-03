import re

css_file = 'Frontend/Glassmorphic-Frontend-Builder/artifacts/citecheck-ai/src/index.css'
with open(css_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the @import url('https://fonts.googleapis.com...'); line
content = re.sub(r"@import\s+url\('https://fonts\.googleapis\.com[^']+'\);?\s*", "", content)

# Update font stacks to high quality zero-network system fonts
content = content.replace(
    "--app-font-sans: 'Manrope', sans-serif;",
    "--app-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;"
)
content = content.replace(
    "--app-font-display: 'Space Grotesk', sans-serif;",
    "--app-font-display: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;"
)
content = content.replace(
    "--app-font-mono: 'DM Mono', monospace;",
    "--app-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;"
)

with open(css_file, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated src/index.css to zero-network system font stack')
