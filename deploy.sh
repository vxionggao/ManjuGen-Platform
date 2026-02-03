#!/bin/bash

# 1. Build Frontend
echo "Building Frontend..."
cd frontend
npm run build
if [ $? -ne 0 ]; then
    echo "Frontend build failed!"
    exit 1
fi
cd ..

# 2. Get Local IP
echo "Detecting Local IP..."
IP=""
if [[ "$OSTYPE" == "darwin"* ]]; then
    # MacOS
    IP=$(ipconfig getifaddr en0)
    if [ -z "$IP" ]; then
        IP=$(ipconfig getifaddr en1)
    fi
else
    # Linux
    IP=$(hostname -I | awk '{print $1}')
fi

if [ -z "$IP" ]; then
    IP="localhost"
fi

echo "=================================================="
echo "Deployment Ready!"
echo "You can access the website at:"
echo "http://$IP:8888"
echo "=================================================="

# 3. Start Backend
echo "Starting Backend..."
# Check if uvicorn is installed
if ! pip show uvicorn > /dev/null 2>&1; then
    echo "Installing uvicorn..."
    pip install uvicorn
fi

python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8888
