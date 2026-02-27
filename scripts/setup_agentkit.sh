set -e
if ! command -v conda >/dev/null 2>&1; then
  echo "conda not found"; exit 1
fi
BASE="$(conda info --base)"
. "$BASE/etc/profile.d/conda.sh"
if ! conda env list | grep -q "^py310"; then
  conda create -n py310 python=3.10 -y
fi
conda activate py310
python -m pip install --upgrade pip
python -m pip install agentkit-sdk-python veadk-python agentkit
agentkit --version
echo "AgentKit CLI installed in conda env py310"
