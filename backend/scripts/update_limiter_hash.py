import hashlib

with open('backend/app/core/limiter.py', 'r', encoding='utf-8') as f:
    c = f.read()

old_code = """        if auth_header.startswith("Bearer "):
            client_key = f"token:{auth_header[7:].strip()[:32]}"
        else:
            forwarded = raw_headers.get(b"x-forwarded-for", b"").decode("utf-8")
            if forwarded:
                client_ip = forwarded.split(",")[0].strip()
            else:
                client = scope.get("client")
                client_ip = client[0] if client else "127.0.0.1"
            client_key = f"ip:{client_ip}" """

# Let's search by lines
lines = c.splitlines()
new_lines = []
for line in lines:
    if line.strip() == 'import collections':
        new_lines.append(line)
        new_lines.append('import hashlib')
    elif line.strip() == 'client_key = f"token:{auth_header[7:].strip()[:32]}"':
        new_lines.append('            token_prefix = auth_header[7:].strip()[:32]')
        new_lines.append('            token_hash = hashlib.sha256(f"citecheck-salt:{token_prefix}".encode("utf-8")).hexdigest()[:16]')
        new_lines.append('            client_key = f"token:{token_hash}"')
    elif line.strip() == 'client_key = f"ip:{client_ip}"':
        new_lines.append('            # Hash IP with salt so no raw IP addresses are stored or held in memory')
        new_lines.append('            ip_hash = hashlib.sha256(f"citecheck-salt:{client_ip}".encode("utf-8")).hexdigest()[:16]')
        new_lines.append('            client_key = f"ip:{ip_hash}"')
    else:
        new_lines.append(line)

with open('backend/app/core/limiter.py', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines) + '\n')

print('Successfully updated limiter.py with hashed IP keys')
