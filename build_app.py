import os
import shutil
import subprocess
import platform
import sys

def build_frontend():
    print("Building frontend...")
    frontend_dir = os.path.join(os.getcwd(), 'frontend')
    # Install dependencies first (just in case, though user said no download at runtime, build time is ok)
    # Use shell=True for windows compatibility or find npm executable, but usually npm is in path
    shell = platform.system() == 'Windows'
    subprocess.check_call(['npm', 'install'], cwd=frontend_dir, shell=shell)
    subprocess.check_call(['npm', 'run', 'build'], cwd=frontend_dir, shell=shell)

def clean_build():
    print("Cleaning previous builds...")
    # Clean build directory
    if os.path.exists('build'):
        shutil.rmtree('build')
    
    # Clean only the specific artifact directory in dist, preserving other releases
    artifact_path = os.path.join('dist', 'FeiXingManJu')
    if os.path.exists(artifact_path):
        shutil.rmtree(artifact_path)

def build_backend():
    print(f"Building backend executable using Python: {sys.executable}")
    # Install pyinstaller if not present
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pyinstaller'])
    
    # Run PyInstaller using the current python interpreter to ensure it sees the same packages
    # Remove --clean flag to avoid permission errors on cached files during build
    env = os.environ.copy()
    env['PYINSTALLER_CONFIG_DIR'] = os.path.join(os.getcwd(), '.pyinstaller_cache')
    subprocess.check_call([sys.executable, '-m', 'PyInstaller', 'FeiXingManJu.spec'], env=env)

def main():
    print(f"Starting build for {platform.system()}...")
    
    # 1. Build Frontend
    if os.path.exists(os.path.join('frontend', 'dist')):
        print("Frontend build found, skipping npm build (remove frontend/dist to force rebuild)")
    else:
        build_frontend()
    
    # 2. Clean
    clean_build()
    
    # 3. Build Backend
    build_backend()
    
    print("\nBuild complete!")
    print(f"Executable is in: dist/FeiXingManJu/")

if __name__ == "__main__":
    main()
