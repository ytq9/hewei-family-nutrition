# 禾味日历

面向家庭的响应式菜单、食材与营养记录 PWA。手机端支持拍照录入和底部导航，电脑端提供宽屏菜单与健康档案界面。

## 当前能力

- 今日与本周菜单、早餐/午餐/晚餐/加餐
- 菜谱、食材重量、可食比例和出品份数
- 按份或按成品克数分配个人摄入
- 能量及 10 项核心营养素计算，缺失数据不会按零处理
- 家庭成员、代管档案、健康共享和体征趋势
- 拍照录入、AI 候选确认流程和手工回退
- 菜谱生成购物清单、单位换算和购买勾选
- CloudBase Auth v2、文档数据库、云函数与私有存储适配
- PWA manifest、静态资源缓存和主屏幕安装提示（健康记录与家庭数据不写入浏览器缓存）

未配置 CloudBase 时，应用自动使用不落盘的体验数据；刷新页面后恢复初始状态。

## 本地运行

要求 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev:cloudbase
```

验证：

```bash
npm test
npm run lint
npm run build:cloudbase
```

## CloudBase 配置

复制 `.env.example` 为 `.env.local`，只填写网页端可公开配置：

```dotenv
NEXT_PUBLIC_CLOUDBASE_ENV_ID=你的环境ID
NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY=你的PublishableKey
NEXT_PUBLIC_SITE_URL=https://你的CloudBase默认域名
```

随后执行 `npm run build:cloudbase`，把 `cloudbase-dist` 目录发布到 CloudBase 静态托管，并按 [cloudbase/README.md](cloudbase/README.md) 创建集合、云函数、安全规则和索引。`TOKENHUB_API_KEY` 只能配置在 `vision-analyze` 云函数环境中，不能出现在 `.env.local`、网页代码或 Git。

## 营养计算约定

- 食材营养 = 每 100g 营养 × 重量 × 可食比例 ÷ 100。
- 按份分配使用菜品总营养与出品份数；按克分配必须先记录成品重量。
- 任一食材缺少某项营养数据时，该项结果保持“不完整”，不会当作零。
- 已确认餐食保存快照，后续菜谱或食物数据修改不应追溯改变历史。
- 页面中的参考进度不构成诊断、治疗或疾病营养建议。

## 数据来源

演示食材保留 USDA FoodData Central 来源编号和版本。正式导入脚本应继续保留来源、版本和缺失字段；不得批量复制版权状态不明确的数据源。
