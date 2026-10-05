# sast.fun 前端自动部署

本文说明独立的 sast.fun 环境。移动端为 `https://shop.sast.fun`，桌面端为 `https://shop-pc.sast.fun`，后端 API 为 `https://api.sast.fun`。仓库根 README 中旧的手动部署流程、分端 SSH Secrets 和服务器内联发布脚本不再适用于此工作流。

## 发布链路

推送 `main` 后，`CI` 完成检查及两端容器冒烟；`Publish Images` 只接收本仓库成功的 main push CI，使用该次 CI 的完整源 SHA 构建并发布两套 GHCR 镜像。两套镜像均成功后，它调用可复用的 `Deploy` 工作流，依次更新 mobile、desktop。没有手动绕过 CI 的镜像发布入口；需要重试时重跑对应的 CI。

发布前以及进入生产部署队列后都通过 GitHub API 检查 main 当前 SHA；过时的自动运行直接跳过，不会以工作流所在分支的 SHA 替代实际构建源 SHA。所有自动及手动部署共用一个并发组，正在部署的运行不会被取消。新提交到来时，运行中的两端部署会先完成，随后新版本在通过 CI 和镜像发布后部署。

镜像使用 `ghcr.io/njupt-sast/sast-shop-v2-frontend-{mobile,desktop}:sha-<完整 SHA>`；服务器 helper 必须核验镜像内的 `org.opencontainers.image.revision` 和实际运行容器的镜像 ID。SHA 标签用于定位版本；GHCR 标签仍可被有写权限的账号覆盖，服务器应记录实际 digest 以供审计与恢复。

## GitHub 配置

Repository Variables：

| 名称                            | 值                              |
| ------------------------------- | ------------------------------- |
| `MOBILE_APP_ORIGIN`             | `https://shop.sast.fun`         |
| `DESKTOP_APP_ORIGIN`            | `https://shop-pc.sast.fun`      |
| `NEXT_PUBLIC_DATA_SOURCE`       | `local`                         |
| `NEXT_PUBLIC_FEEDBACK_FORM_URL` | 可选；获准的飞书 HTTPS 表单地址 |

Repository Secret `NEXT_PUBLIC_FEISHU_APP_ID` 使用本环境的飞书应用 ID；它是公开构建参数，会进入客户端包，不能填 App Secret。发布 job 使用 GitHub 自动提供的 `GITHUB_TOKEN` 写入本仓库的 GHCR 包；须允许仓库对这两个包具有写权限。部署 job 仅授予 `packages: read`，使用该 job 的短期 `GITHUB_TOKEN` 拉取镜像。新建 GHCR 包即使保持私有，也无需长期 PAT；已有包需在其 Actions access 设置中授权本仓库读取。

创建 `production` Environment，并配置以下四个 Secrets：

| 名称                     | 内容                                        |
| ------------------------ | ------------------------------------------- |
| `SERVER_HOST`            | `sast.fun`                                  |
| `SERVER_USER`            | 专用于商城部署的 SSH 账号                   |
| `SSH_PRIVATE_KEY`        | 对应的专用部署私钥                          |
| `SERVER_SSH_FINGERPRINT` | 经独立核对的服务器 SSH 主机公钥 SHA256 指纹 |

Secrets 缺失会在连接前失败。不要提交任何私钥或服务器 `.env`。无需在 Actions 配置旧的 `MOBILE_*`、`DESKTOP_*` 或 GHCR 读取 Secrets。若要求推送后全自动发布，`production` 不配置 required reviewers；如设置审批规则，部署会按 GitHub Environment 规则等待审批。Environment 的部署分支限制为 `main`。

## 服务器前置条件

首次安装由管理员完成。`/data/sast-shop-mobile` 和 `/data/sast-shop-desktop` 各有独立 Compose 项目、受保护的 `.env` 和专用缓存卷，宿主机分别监听 `127.0.0.1:23001`、`127.0.0.1:23002`，映射容器内的 `3001`、`3002`。运行配置应设置 `AUTH_MODE=required`、`CONNECT_BASE_URL=https://api.sast.fun`、相应后端健康地址和本环境的会话密钥；桌面端 OAuth 回调为 `https://shop-pc.sast.fun/auth/callback`。`NEXT_PUBLIC_*` 固化在镜像构建阶段，修改域名后必须重新构建。

服务器应安装 root 所有且部署账号不可修改的 `/usr/local/lib/sast-shop/deploy-image`，接口为：

```text
sudo -n /usr/local/lib/sast-shop/deploy-image <mobile|desktop> <完整 SHA> <GHCR 镜像引用> --registry-stdin
```

该 helper 负责校验参数、全局 `flock`、拉取镜像、核验版本、记录旧镜像、只更新选定项目的 web 服务、验证容器真实镜像与就绪状态，以及失败恢复原版本并重新检查。只授予专用账号调用该受限 helper 的 sudo 权限；不授予任意 sudo 或 Docker daemon 权限。工作流不修改代理配置、不执行全局镜像清理、不删除数据卷、不构建服务器上的镜像。

工作流通过经过主机指纹校验的 SSH 连接传入部署 job 的短期令牌；远端 Python 将 `registry`、`username`、`password` 编码为 JSON，直接通过管道写入 helper 的标准输入。令牌不放入 helper 命令参数、发布日志或服务器持久凭据文件；SSH action 的 debug 保持关闭。helper 必须使用独立临时 Docker 配置登录，完成或失败后清除，保留服务器原有 Docker 登录配置。自动及手动 GitHub 部署均不需要 `/etc/sast-shop/registry.env`、`registry.json` 或个人 PAT。

两端按顺序发布，每个服务独立回滚；例如桌面端失败时，mobile 可能已经升级，工作流会失败并停止。应查看服务器发布记录并重试或显式回退相应服务。数据库迁移及飞书平台配置不由此工作流执行，必须在上线前单独完成兼容性验证。

## 手动重试与回退

在 `Deploy` 选择 main 分支、`both` / `mobile` / `desktop`，填写已发布的 `sha-<完整 SHA>`。手动请求必须满足：提交仍在 main 历史中，该 SHA 最新一条 main push CI 已成功，对应镜像存在且镜像版本核验通过。手动回退允许历史提交；自动发布仅允许当前 main。若回退目标来自旧环境域名或旧鉴权配置，不应直接复用，应重新构建适合本环境的版本。

每次首次启用或变更服务器配置后，核验两端 live/ready、真实飞书登录与退出、API 内部接口隔离，并确认服务器其他站点正常。工作流成功代表镜像发布及 helper 检查成功，不能代替本人账号的完整业务验收。
