import os
import shutil
import time
import subprocess
import sys

def main():
    # 1. Define timestamp and paths
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    dist_root = "dist"
    release_dir = os.path.join(dist_root, timestamp)
    
    print(f"Packaging release to: {release_dir}")
    
    # 2. Run Build
    print("Running build process...")
    try:
        # Run the existing build script
        subprocess.check_call([sys.executable, "build_app.py"])
    except subprocess.CalledProcessError as e:
        print(f"Build failed: {e}")
        sys.exit(1)
        
    # 3. Create release directory
    if not os.path.exists(release_dir):
        os.makedirs(release_dir)
        
    # 4. Move build artifact
    # build_app.py outputs to dist/FeiXingManJu
    source = os.path.join(dist_root, "FeiXingManJu")
    destination = os.path.join(release_dir, "FeiXingManJu")
    
    if os.path.exists(source):
        if os.path.exists(destination):
            shutil.rmtree(destination)
        shutil.move(source, destination)
        print(f"Moved build artifact to {destination}")
    else:
        print(f"Error: Build artifact not found at {source}")
        sys.exit(1)
        
    # 5. Write Release Notes
    release_notes = """# 发布说明 (Release Notes) - {}

## 摘要
本次发布主要修复了后端在高并发控制组件中的线程安全问题，优化了前端模型配置页面的交互体验，支持行内编辑和保存。

## 主要更新

### 前端
*   **模型配置优化**:
    *   **行内编辑**: 支持直接在表格中编辑 Endpoint ID、并发配额和请求配额。
    *   **布局调整**: 优化了表格列宽，界面更加紧凑。
    *   **交互改进**: 增加了编辑/保存/取消操作的图标按钮，操作更加直观。
*   **Bug 修复**:
    *   **系统设置页面**: 修复了页面滚动问题，确保底部配置项可访问。

### 后端
*   **严重 Bug 修复**:
    *   **线程安全**: 修复了 `TokenBucket` 在 FastAPI 线程池中初始化时抛出 `RuntimeError: There is no current event loop` 的问题。现在采用懒加载策略，确保信号量在主事件循环中正确创建。
*   **兼容性修复**:
    *   **Python 3.9 支持**: 修复了类型提示语法兼容性问题。
    *   **WebSocket**: 修复了 WebSocket 库检测警告。

### 基础设施
*   **构建优化**: 优化了打包脚本，支持增量发布，不再删除历史发布包。

""".format(timestamp)

    with open(os.path.join(release_dir, "release.md"), "w", encoding="utf-8") as f:
        f.write(release_notes)
        
    print(f"Created release.md at {os.path.join(release_dir, 'release.md')}")
    print("\nPackaging Complete!")

if __name__ == "__main__":
    main()
