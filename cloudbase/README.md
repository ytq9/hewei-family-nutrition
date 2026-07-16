# CloudBase 部署清单

1. 创建 CloudBase Web 环境，启用 Auth v2 的邮箱验证码与内置邮件代理。
2. 在安全来源中加入 CloudBase 静态托管默认域名。
3. 创建 `nutrition-api` 与 `vision-analyze` 两个 Node.js 云函数，分别上传对应目录并安装依赖。
4. 在云函数权限控制中应用 `function-security.json`；数据库安全规则设为客户端禁止直读写，所有敏感操作经云函数完成。
5. 创建集合：`users`、`households`、`memberships`、`members`、`invites`、`foods`、`recipes`、`meals`、`intakeSnapshots`、`vitals`、`shoppingLists`、`consents`、`mediaAnalysisJobs`、`aiUsage`。
6. 为 `memberships(uid,status)`、`members(householdId)`、`meals(householdId,date)`、`vitals(householdId,memberId)`、`aiUsage(householdId,day)` 建组合索引。
7. 仅在 `vision-analyze` 云函数中配置 `TOKENHUB_API_KEY`、`VISION_MODEL_ID` 和 `AI_DAILY_LIMIT_PER_HOUSEHOLD`。
8. 网页构建时配置 `NEXT_PUBLIC_CLOUDBASE_ENV_ID` 与 `NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY`。
9. 同时把静态托管默认 HTTPS 域名配置为 `NEXT_PUBLIC_SITE_URL`，执行 `npm run build:cloudbase`，再将 `cloudbase-dist` 目录发布到 CloudBase 静态托管。

首次上线前还应在 CloudBase 控制台完成以下核对：邮箱验证码登录已启用内置邮件代理；默认域名已加入安全来源；两个云函数均不可被未登录用户直接调用；数据库客户端直读写被拒绝；图片存储为私有；AI 日限额和费用告警已经生效。

不要把 TokenHub Key、CloudBase 管理员 API Key 或用户健康数据写入日志、网页环境变量或 Git。
