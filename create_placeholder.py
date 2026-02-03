import os

# Create directory
public_dir = "/Users/bytedance/python_projects/et_副本/frontend/public"
if not os.path.exists(public_dir):
    os.makedirs(public_dir)

# 1x1 Gray PNG
data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDAT\x08\xd7c\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB`\x82'

path = os.path.join(public_dir, "placeholder.png")
with open(path, "wb") as f:
    f.write(data)

print(f"Created {path}")
