# Areium · React 个人博客

## 当前内容与维护

首页使用带头图的文章卡片和个人信息面板，已移除 SIDE PROJECTS 区块。技术调研与《彼岸双生》已导入本地，尚未发布到远程服务器。

已增加日间 / 夜间模式，右上角按钮切换并在浏览器中记住选择；未选择时跟随系统。HTML 互动文章也会同步主题。正文约 18px（手机 17px），文章卡片标题 21px、摘要 15px，标签以加粗色块突出显示。

当前仅收录四篇实际文章，示例文章已从索引移除，旧博客入口与旧文回链也已移除：

- vLLM 动态课堂：`content/vllm-dynamic-classroom.html`，保留七组交互演示。独立源码地图不包含在此文章中，源码链接指向原有 GitHub 快照。
- 深入 vLLM 中文译稿：`content/inside-vllm-zh.md`，标记“好文搬运”，保留原作者 Aleksa Gordic、原文日期与链接；18 张原文配图保存在 `public/images/inside-vllm/`。提供的原始译稿备份在 `content/imports/inside-vllm-original.md`。
- 昇腾 × NVIDIA 调研。
- 《彼岸双生》。

新增两篇的 2026-11-05 为本站收录日期；译文原作日期单独显示，不冒充原创。

- `content/posts.json`：每篇文章的标题、摘要、发布日期、分类 `category`、多个标签 `tags`、头图路径 `cover`。标签和分类筛选项自动从此文件生成；点击卡片标签可进入对应筛选页。修改后开发模式刷新，生产部署需要重新构建。
- `content/profile.json`：姓名、简介、邮箱、GitHub 地址、头像路径。
- `public/images/avatar.jpg`：来自旧博客 `/images/nifu.jpg` 的原头像。
- `public/covers/`：各篇文章的本地 SVG 头图。可以改为自己的 jpg/png/webp，并更新 `cover`。
- `content/ascend-nvidia-comparison.html`：导入的完整互动调研，已适配暖白背景。表格、来源、图表与计算器保留；通过隔离的 iframe 承载，避免文章脚本访问登录状态。正文不依赖外部网络。原始 HTML 文件未改动。
- `content/bian-shuangsheng.md`：从旧站迁移的小说，保留 2026-09-07 日期、全部八个章节。旧页面副本保存在 `content/imports/` 便于核对。

添加文章时，在 `content` 中新增 Markdown 文件，然后在 `content/posts.json` 中增加一项。例如：

```json
{
  "slug": "my-new-post",
  "title": "我的新文章",
  "description": "文章摘要",
  "category": "技术调研",
  "tags": ["React", "新标签"],
  "date": "2026-11-05",
  "minutes": 5,
  "cover": "/covers/my-new-post.jpg"
}
```

正文对应 `content/my-new-post.md`，封面对应 `public/covers/my-new-post.jpg`。当前通过本地文件维护标签，没有新增网页管理后台。已移除的示例 Markdown 仍留作写作格式参考，不会出现在网站或文章接口中。

本地优先的中文技术博客，基于 Next.js App Router / React / Node.js 24。包括响应式首页、Markdown 文章、目录和代码高亮、分类搜索、作品集、JSON 工具、专注时钟、GitHub OAuth 登录和 SQLite 审核式评论。

本站尚未接入 Payload 或可视化文章后台。文章通过 Markdown / HTML 文件维护，元数据通过 JSON 维护，评论通过命令行审核。历史作品演示页面仍保留，但不再出现在首页和主导航中。没有上传到云服务器或远程仓库。

## 本地运行

本机已安装独立的 Node.js 24、npm 和 pnpm，并加入用户 PATH。配置后需要重新打开终端；VS Code 的集成终端如仍找不到命令，请重启 VS Code。

Windows PowerShell 启动：

```powershell
cd C:\Users\a\Documents\ChatGPT\blog
node --version
pnpm dev
```

本机 `.env.local` 已生成随机会话密钥，GitHub OAuth 的 Client ID 与 Client Secret 需自行填写。重复配置脚本位于 `scripts/setup-local-node.ps1`，从 Node.js 官方下载 Node 24 并核验 SHA-256，使用用户目录安装，不需要修改系统级 PATH。

安装 Node.js 24 与 pnpm，然后在本目录运行：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

打开 http://localhost:3000。请使用 localhost 而不是 127.0.0.1，以便与 OAuth 回调及 SITE_URL 保持一致。

首次配置：复制 `.env.example` 为 `.env.local`。没有 GitHub 配置也能阅读文章和使用工具；登录按钮会显示等待配置。

```sh
pnpm test
pnpm build
pnpm start
```

## GitHub 登录配置

在 GitHub → Settings → Developer settings → OAuth Apps → New OAuth App 创建本地应用：

- Homepage URL：`http://localhost:3000`
- Authorization callback URL：`http://localhost:3000/api/auth/callback/github`

将 Client ID、Client Secret 填入 `.env.local`，并生成独立的会话密钥（不少于 32 字符）：

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

```dotenv
SITE_URL=http://localhost:3000
GITHUB_CLIENT_ID=你的ClientID
GITHUB_CLIENT_SECRET=你的ClientSecret
AUTH_SECRET=上面生成的随机密钥
BLOG_DATA_DIR=./data
```

重启服务后，从文章评论区登录。只读取公开 GitHub 身份，不申请仓库或邮箱权限，不保存访问令牌。实现了 state 校验、PKCE、HttpOnly 签名会话、七天会话过期与同源写入校验。正式域名启用 HTTPS 后会话 Cookie 自动使用 Secure。`.env.local` 不进入 Git；不要把密钥放入浏览器端代码。

GitHub OAuth 的真实往返需要应用凭据及用户授权，未配置时无法完成真实账号验证。建议本地和生产环境分别创建 OAuth App，避免频繁修改回调。

参考：https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps

## 内容修改

- `lib/content.js`：站点名称、内容读取和历史作品信息；文章索引位于 `content/posts.json`。
- `content/*.md`：文章正文；新增文章时同时在索引中添加唯一 slug。
- `app/about/page.jsx`：个人介绍。
- `app/globals.css`：颜色、排版与响应式样式。
- `components/Demos.jsx`：作品演示，可扩展为自己的小工具。

代码高亮、GFM 表格、二级目录已支持。不执行 Markdown 内的原始 HTML。默认不加载第三方图片或字体。

## 评论管理

评论保存在 `data/comments.sqlite`，默认待审核，同一 GitHub 用户一分钟内只能提交一次。只公开最近 100 条已审核评论。首次运行会自动建表，不预置虚假评论。

```sh
pnpm comments list
pnpm comments approve 1
pnpm comments reject 1
```

若在 `.env.local` 中设置了自定义数据库目录，使用以下命令确保管理同一份数据：

```sh
node --env-file=.env.local scripts/comments.mjs list
```

## 后续推送及宝塔部署

正文使用本地托管的 OPPO Sans 3.0，字体来源和官方使用条款见 `public/fonts/SOURCE.txt`。Markdown 和嵌入式 HTML 文章共用字体，代码保持等宽字体。字体使用原始文件（约 9 MB），首次访问会先显示系统字体，下载完成后自动切换。

Git 远程仓库为 `https://github.com/Areium/areium-blog.git`，主分支为 `main`。`.gitignore` 已排除依赖、构建产物、数据库与环境变量。提交源码、静态资源、package.json 和 pnpm-lock.yaml；服务器单独配置 `.env.local`。

服务器使用 Node.js 24。上传源码或拉取仓库后：

1. 运行 `pnpm install --frozen-lockfile`。
2. 创建服务器自己的 `.env.local`，设置 SITE_URL、GitHub OAuth 信息、随机 AUTH_SECRET 与持久化 BLOG_DATA_DIR。建议数据库目录放在发布目录外。
3. 运行 `pnpm build`，通过宝塔 Node 项目/进程管理器执行 `pnpm start`，设置项目根目录为工作目录并配置自动重启。也可直接执行 `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000`。
4. 在宝塔网站中设置 Nginx 反向代理到 `http://127.0.0.1:3000`，参考 `deploy/nginx.conf.example`。
5. 暂用 IP 时，SITE_URL 设置成实际访问地址，OAuth App 回调同时改为对应地址。正式登录建议在启用 HTTPS 后使用。
6. 域名就绪后添加 DNS、宝塔域名及证书，更新 SITE_URL 和 GitHub 回调，重启应用。数据库与文章可继续使用。

更新源码后重新安装锁定依赖、构建并重启进程。不要覆盖服务器的环境文件和数据目录。

备份 SQLite 时先停止应用及评论管理进程，再备份整个数据目录（包括可能存在的 WAL 文件）；或使用 SQLite 在线备份工具创建一致性快照。恢复时同样先停止应用。
