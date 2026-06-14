# ⚓ 近海小船船期配载系统 Coastal Vessel Stowage Management

面向近海内河中小型船舶调度配载作业管理系统。支持码头调度员配置船只与订单、系统自动多维度货物冲突检测、船长电子确认装船、货主客户自助查询ETD/ETA船期。

## ✨ 系统特性

### 三角色业务闭环
| 角色 | 核心功能 |
| :--- | :--- |
| 👨‍✈️ 调度员 | 船只载重/容积/箱容参数录入、货主订单管理、港口潮汐窗口、危险品互斥规则配置、配载计划创建与冲突校验 |
| 🧑‍✈️ 船长 | 待装船计划核对、货物清单查阅、电子签字确认装船、禁止高危冲突计划强制拦截 |
| 🧑‍💼 货主客户 | 订单号/货主姓名/电话三维度查询、ETD预计离港时间、ETA预计到港时间、航线与船只信息展示 |

### 七维度货物冲突检测引擎
1. **载重超载检测**：总载重吨 vs 船只最大载重
2. **容积超容检测**：总体积 vs 船只舱容
3. **集装箱容量**：20/40英尺箱数 vs 船舶箱格
4. **危险品互斥矩阵**：9类危险品 + 食品类货物污染规则
5. **港口航线兼容**：订单起止港匹配船只航线
6. **交货期紧迫警告**：距交货期不足3天触发警告
7. **潮汐吃水限制**：船舶吃水 vs 潮汐允许最大吃水

## 🏗️ 系统架构

```
┌───────────────────────────────────────────────────────────┐
│                    前端 (5173端口                │
│   React 18 · TypeScript · Vite · TailwindCSS   │
│   React Router 6 · Axios                            │
└────────────────────┬──────────────────────────────────┘
                     │ Vite /api 反向代理
┌────────────────────┴──────────────────────────────────┐
│                    后端 (3001端口                │
│   Express 4 · TypeScript · Zod 校验               │
│   ┌──────────────────────────────────────────┐       │
│   │  核心冲突检测 stowageService.ts       │       │
│   │  17条近海航线距离 + 7维度校验        │       │
│   └──────────────────────────────────────────┘       │
│   ┌──────────────────────────────────────────┐       │
│   │  自研存储层 db.ts                   │       │
│   │  JSON持久化 + SQL解析兼容层          │       │
│   └──────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────┘
```

> **技术选型说明：因 `better-sqlite3` 在 Node.js 26 存在V8 API兼容性问题，采用自实现 JSON 文件持久化 + 自研 SQL 解析引擎（支持 INSERT/SELECT/UPDATE/DELETE/JOIN/WHERE/ORDER BY/LIMIT/事务），为近海场景数据量（千级以内性能充足。

## 🚀 快速启动

### 环境要求
- **Node.js** >= 20+（推荐 22/26）
- **npm** >= 10+

### 一键启动（前后端并发）
```bash
npm install
npm run dev
```

### 分别启动
```bash
# 后端 API (端口 3001，含热重载)
npm run dev:backend

# 前端页面 (端口 5173，Vite HMR)
npm run dev:frontend
```

启动完成后浏览器访问：**http://localhost:5173**

### 生产构建
```bash
npm run build
npm start
```

## 📂 项目结构

```
.
├── backend/                          # 后端服务
│   ├── src/
│   │   ├── db.ts                   # JSON持久化 + SQL兼容层
│   │   ├── index.ts                # Express入口 + 种子数据
│   │   ├── types.ts                # 7张数据表 + 业务类型
│   │   ├── stowageService.ts      # ⭐ 冲突检测核心算法
│   │   └── routes/
│   │       ├── vessels.ts            # 船只管理 API
│   │       ├── orders.ts           # 货主订单 API
│   │       ├── stowage.ts         # 配载计划 + 客户查询 (8端点)
│   │       └── config.ts            # 潮汐窗口 + 危险品规则
│   └── data/                      # JSON持久化数据目录
│   └── package.json
│
├── frontend/                         # 前端应用
│   ├── src/
│   │   ├── App.tsx                 # 三角色Tab切换 + 路由
│   │   ├── main.tsx
│   │   ├── index.css               # Tailwind + 自定义sea色板
│   │   ├── api/client.ts           # Axios封装
│   │   ├── types/index.ts        # 前端业务类型
│   │   └── pages/
│   │       ├── Dashboard.tsx       # 调度员首页
│   │       ├── Vessels.tsx         # 船只管理
│   │       ├── Orders.tsx          # 货主订单
│   │       ├── CreateStowage.tsx  # ⭐ 配载计划创建向导
│   │       ├── StowagePlans.tsx   # 计划列表
│   │       ├── StowageDetail.tsx   # 计划详情
│   │       ├── CaptainConfirm.tsx # ⭐ 船长工作台
│   │       ├── CustomerSearch.tsx # ⭐ 客户自助查询
│   │       └── Config.tsx          # 潮汐与危险品配置
│   └── package.json
│
├── package.json                    # Monorepo npm workspaces
└── README.md
```

## 🧭 业务数据模型（7张表）

| 表名 | 说明 | 关键字段 |
| :--- | :--- | :--- |
| `vessels` | 船舶档案 | 载重吨/容积/吃水/航线/20&40英尺箱容 |
| `cargo_orders` | 货主订单 | 货物类型/重量体积/危险品标志/交货期 |
| `dangerous_goods_rules` | 危险品冲突矩阵 | 类别A↔类别B/冲突等级(critical/high/medium/low) |
| `tide_windows` | 港口潮汐窗口 | 港口/日期/高潮时段/允许最大吃水 |
| `stowage_plans` | 配载计划 | 船名/航次/ETD/ETA/状态/船长确认 |
| `stowage_plan_items` | 计划-订单关联 | 配载位置/装船顺序 |
| `conflict_reports` | 冲突检测报告 | 冲突类型/严重等级/涉及订单 |

## 📡 核心 API 端点

### 配载计划 (stowage.ts)
| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `GET` | `/api/stowage/stats` | Dashboard 6项核心统计卡片 |
| `GET` | `/api/stowage` | 配载计划列表（支持状态筛选） |
| `GET` | `/api/stowage/:id` | 计划详情（含货物+船+潮汐关联） |
| `POST` | `/api/stowage` | 创建配载计划 + 自动7维冲突检测 |
| `POST` | `/api/stowage/:id/confirm` | 船长确认装船（拦截高危冲突） |
| `POST` | `/api/stowage/:id/status` | 手动更新计划状态 |
| `DELETE` | `/api/stowage/:id` | 删除计划（已确认禁止删除） |
| `GET` | `/api/stowage/customer/search` | ⭐ 客户自助查询ETD/ETA |

### 其他模块
- **船只**：`/api/vessels/*`
- **订单**：`/api/orders/*`
- **配置**：`/api/config/tide-windows/*` + `/api/config/dangerous-rules/*`

## 🧪 航线距离映射表（17条近海航线）
| 航线 | 航行时长（小时） |
| :--- | :--- |
| 青岛 → 烟台 | 8 |
| 青岛 → 大连 | 24 |
| 烟台 → 大连 | 15 |
| 青岛 → 天津 | 30 |
| 烟台 → 天津 | 22 |
| 大连 → 天津 | 20 |
| 青岛 → 秦皇岛 | 26 |
| 烟台 → 秦皇岛 | 18 |
| 青岛 → 营口 | 32 |
| 上海 → 宁波 | 6 |
| 上海 → 福州 | 28 |
| 宁波 → 福州 | 22 |
| 福州 → 厦门 | 16 |
| 厦门 → 汕头 | 18 |
| 汕头 → 深圳 | 12 |
| 深圳 → 广州 | 8 |
| 广州 → 海口 | 30 |
| （其他未列航线默认值：**24 小时 |

## ✅ 质量验证

TypeScript 类型检查（已验证通过）
```bash
# 后端
npx tsc --noEmit -p backend/tsconfig.json

# 前端
npx tsc --noEmit -p frontend/tsconfig.json
```

## 🛡️ 安全与约束
- 船长确认装船前强制校验：存在 `critical` 或 `high` 级冲突的计划禁止确认，调度员须先调整货物
- 已确认的计划禁止删除（保护业务数据完整）
- 所有请求参数经 Zod Schema 校验
- 所有写入操作支持事务回滚

## 📄 License
ISC
近海小船船期配载系统 © 2026 码头调度中心
