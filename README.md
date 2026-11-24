# Miemie's Notes

杭州电子科技大学研究生 MiemieYang02 的工程项目分享站。使用 Astro 6 和 Markdown 构建静态站点，目标地址为 [miemieyang02.github.io](https://miemieyang02.github.io/)。

## 本地开发

使用 Node.js 24 和 npm。在 Windows PowerShell 中运行：

```powershell
Set-Location 'E:\github-repo-others\my-web\MiemieYang02.github.io'
npm.cmd ci
npm.cmd run dev
```

浏览器打开终端显示的 Local 地址，默认是 <http://localhost:4321/>。开发服务器会自动刷新。用 Ctrl+C 停止。检查正式发布效果时，在同一目录运行：

```powershell
npm.cmd run build
npm.cmd run preview
```

## 项目结构

| 位置 | 用途 |
| --- | --- |
| `src/content/projects/` | 每份项目 Markdown 对应一个项目详情页 |
| `src/content.config.ts`、`src/lib/` | 元数据校验、公开内容筛选、排序、搜索文本与反向引用 |
| `src/pages/` | 首页、关于页和项目目录和详情路由 |
| `src/layouts/`、`src/components/`、`src/styles/` | 网站外壳、导航、项目列表与响应式排版 |
| `scripts/import-note.mjs`、`templates/project.md` | Obsidian 单篇导入命令与项目模板 |
| `scripts/markdown.mjs`、`astro.config.mjs` | Markdown 扩展、公式、代码与图表处理 |
| `public/` | 站点图标，这里的文件会原样公开 |
| `.github/workflows/deploy.yml` | 构建静态文件并部署到 GitHub Pages |

## 添加工程项目

复制 `templates/project.md` 到 `src/content/projects/`，例如命名为 `reading-gpio.md`。文件名用稳定的短名，发布后改名会改变网址。日期填写实际写作或发布日期。

```yaml
---
title: GPIO 输入监测工具
description: 说明项目解决的问题和使用场景。
date: 2026-11-24
category: 嵌入式系统
tags: [Linux, GPIO]
draft: true
---
```

定稿后将 `draft` 改为 `false`，重新构建即可。缺省值为 `true`。项目目录每页显示 10 个项目，搜索会匹配全部公开项目的标题、正文、分类与标签（每页数量在 `src/lib/pagination.ts` 中设置），正文的二、三级标题生成目录，已公开的站内项目链接会生成「引用此项目」。列表默认按发布日期从新到旧排列，同日按文件 ID 排序。

## 从 Obsidian 导入项目说明

**先选择一篇笔记。** 以下路径仅为示例，替换为自己的实际路径。命令从项目根目录运行。

```powershell
$note = 'D:\Obsidian\工程\网关采样.md'
$vault = 'D:\Obsidian'
$attachments = 'D:\Obsidian\附件'
npm.cmd run import:note -- "$note" --vault "$vault" --attachments "$attachments" --slug gateway-sampling
```

这会在 Git 忽略的 `.local-drafts/projects/` 写入转换后的笔记及图片。打开该副本检查标题、双链转换与图片，修改内容时优先回到 Obsidian 原文。导入器只读取指定笔记及正文引用的本地图片，保留原始笔记。若要重新生成同名草稿，加入 `--replace`。

**确认公开后，从原文生成发布副本。**

```powershell
npm.cmd run import:note -- "$note" --vault "$vault" --attachments "$attachments" --slug gateway-sampling --publish
npm.cmd run build
npm.cmd run preview
```

结果位于 `src/content/projects/gateway-sampling.md`，资源位于同目录的 `assets/gateway-sampling/`。下次更新同一篇已公开项目时加上 `--publish --replace`。发布导入总是从指定的源文件读取，保留其支持的标题、摘要、日期、分类、标签和别名，显式的 `--publish` 将副本写为 `draft: false`。它只在本地准备文件。若直接编辑过网站副本，重新导入前先核对差异。

### 支持的笔记语法

| 笔记写法 | 站点行为 |
| --- | --- |
| 标准 Markdown、表格、带语言名的代码块 | 静态 HTML、Shiki 高亮和复制按钮 |
| `$E=mc^2$` 或独立的 `$$` 公式块 | 构建时由 KaTeX 排版 |
| 语言为 `mermaid` 的围栏代码块 | 有图的详情页才加载本地 Mermaid；渲染失败或关闭 JavaScript 时可读源码 |
| `> [!tip] 标题` | Callout 标题和正文；无标题时显示类型名 |
| `[[笔记名#标题\|显示文本]]` | 导入时按已公开笔记的文件 ID、标题或别名匹配，转换成站内链接；同一页可用 `[[#标题]]` |
| `![[图片.png]]`、`![[附件/图片.png\|图片说明]]`、标准 Markdown 本地图片 | 复制所引用的图片，以内容摘要命名并改写路径 |

链接解析只查网站里已公开的内容。目标尚未公开、同名或只能定位到 Obsidian 块 ID 时，命令会给出提示并保留可读文字。等目标公开后再导入引用方，可以补上链接。笔记嵌入仅转为引用；代码示例中的双括号保持原文。图片按笔记目录、显式知识库根和附件目录中的相对路径解析，重名时请写出子目录。远程图片使用标准 Markdown URL。Obsidian 插件查询、白板和复杂块嵌入需先整理为普通 Markdown。

草稿适合存放在 Obsidian 或 `.local-drafts/`。放入公开 Git 仓库并提交的源文件可被直接读取，即使设置了 `draft: true`。项目及其附件应一起检查后纳入版本管理。

## GitHub Pages

1. 首次部署时，在 GitHub 仓库的 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 检查本地站点后，将需要发布的源码、图片、工作流及 `package-lock.json` 一起提交并推送到 `main`。依赖目录和 `dist/` 已加入忽略规则。
3. 工作流会构建并上传静态产物，部署作业使用 GitHub 提供的短期身份。可在 **Actions → Deploy projects to GitHub Pages** 查看运行结果，或手动触发已存在于远端的工作流。

这是用户主页仓库，站点从域名根目录提供服务。部署方式参见 [Astro 的 GitHub Pages 文档](https://docs.astro.build/en/guides/deploy/github/)。
