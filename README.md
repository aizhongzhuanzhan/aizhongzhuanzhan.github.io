# AI 中转站推荐

面向 GitHub Pages 的原生静态 HTML 排名站：<https://aizhongzhuanzhan.github.io/>。榜单、模型专题、选择指南与 FAQ 都在构建时写入 HTML，不依赖客户端渲染。

## 本地构建

```bash
npm run build
npm test
```

同步最新公开数据并重新生成：

```bash
npm run sync
```

默认数据源为 `hvoyai/awesome-ai-api` 的 `data.json`，也可通过 `DATA_SOURCE_URL` 覆盖。构建器先按来源名次排序并去重，最多保留 60 条；随后依据数据日期，在每 5 条的相近名次带内做可复现的轻微轮换。同一数据日期重复构建会产生相同结果。

## 生成内容

- `index.html`、`page/2/index.html`：每页最多 30 条的静态榜单
- `*-zhongzhuanzhan/index.html`：GPT、Claude、Codex、Gemini、GLM、Qwen、Kimi 专题
- `data.json`：最多 120 条的构建快照，包含展示名次与来源名次
- `sitemap.xml`、`robots.txt`、`404.html`：搜索引擎抓取与错误页资源
- `assets/styles.min.css`：由可维护的 `assets/styles.css` 构建

## GitHub Pages

仓库的 Pages 设置选择 **Deploy from a branch**，分支为 `main`，目录为 `/ (root)`。`.github/workflows/update-site.yml` 每天 03:17、15:17 UTC 自动同步两次；同步失败会重试，通过测试后才提交变化。
