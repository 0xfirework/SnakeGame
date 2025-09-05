# 贪吃蛇 Snake（纯前端）

一个零依赖、可在桌面与移动端游玩的贪吃蛇小游戏网站：

- 方向键/WASD 操作，空格开始/暂停，R 重开
- 速度可调，内置记分与本地最高分（localStorage）
- 响应式布局 + 触控方向键（移动端）

## 运行

直接用浏览器打开 `index.html` 即可。

推荐使用本地静态服务器（可选）：

```bash
# Python 3
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

## 文件结构

- `index.html`：页面结构与控件
- `style.css`：页面与画布样式
- `script.js`：游戏逻辑（网格、蛇移动/碰撞/食物/记分）

## 自定义

- 网格尺寸：修改 `script.js` 中的 `GRID`（默认 21）
- 初始长度：修改 `INITIAL_LEN`（默认 4）
- 速度范围：修改 `index.html` 滑杆的 `min/max/value`

