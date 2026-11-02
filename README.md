# 足球战术盘（网页版）

纯静态网页，不需要安装，也不需要打包：把这个文件夹放到任何网页托管（比如 GitHub Pages）就能用。

## 本地预览

浏览器不允许直接双击 `index.html` 加载模块，要开一个本地服务器：

```bash
python -m http.server 8000
```

然后打开 <http://localhost:8000>。

## 目录

| 位置 | 内容 |
|---|---|
| `index.html` | 页面骨架 |
| `css/style.css` | 样式和手机布局 |
| `assets/` | 球场图、足球图片 |
| `js/main.js` | 入口：创建各模块并接好它们之间的通知 |
| `js/data/` | 纯数据：阵型、球衣、战术、进攻脚本 |
| `js/core/` | 坐标换算、路线磨平 |
| `js/game/` | 棋子的状态和规则：球员、足球、轨迹、存档格式 |
| `js/tactics/` | 战术计算：站位、逐步演化。不碰画面 |
| `js/ui/` | 界面：画布、鼠标手指操作、菜单、面板、演示播放 |

## 想改什么就看哪里

| 想改的 | 文件 |
|---|---|
| 常见阵型、默认号码 | `js/data/formations.js` |
| 球衣颜色 | `js/data/jerseys.js` |
| 战术列表、攻防对应、防守反应 | `js/data/tactic_data.js` |
| 进攻演化的每一步 | `js/data/attack_scripts.js` |
| 演示快慢 | `js/ui/tactic_player.js` 开头的 `STEP_MS`、`PAUSE_MS` |
| 接着打时的跑动上限 | `js/tactics/simulation.js` 开头的 `MAX_RUN` |
