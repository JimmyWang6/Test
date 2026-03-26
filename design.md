# 网页版五子棋游戏设计文档

## 1. 项目概述

### 1.1 项目背景
五子棋（Gomoku）是一种经典的两人对弈棋盘游戏，玩家轮流落子，先在横、竖或斜方向连成五子的一方获胜。本项目旨在开发一款运行于浏览器的全栈网页版五子棋游戏，前端负责渲染与交互，后端负责游戏状态持久化与 API 服务。

### 1.2 项目目标
- 提供流畅、美观的网页五子棋对局体验（本地双人对战）
- 前后端分离，后端提供 RESTful API
- 支持游戏状态持久化（对局记录查询）
- 提供完整的测试覆盖（单元测试 + API 集成测试）

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────┐
│                  Browser (前端)                  │
│  index.html  ─  Canvas 渲染  ─  Fetch API 调用  │
└──────────────────────┬──────────────────────────┘
                       │ HTTP / REST
┌──────────────────────▼──────────────────────────┐
│              Node.js + Express (后端)            │
│  路由层  ─  业务逻辑层  ─  数据访问层             │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│           内存存储 / SQLite（数据层）             │
└─────────────────────────────────────────────────┘
```

---

## 3. 前端设计

### 3.1 技术栈

| 层次 | 技术 |
|------|------|
| 界面结构 | HTML5 |
| 样式 | CSS3（Flexbox、过渡动画） |
| 逻辑 | 原生 JavaScript ES6+ |
| 渲染 | HTML5 Canvas 2D |
| 后端通信 | Fetch API |

### 3.2 模块划分

```
index.html
├── <style>          样式层：页面布局、配色、动画
├── <canvas>         渲染层：棋盘、棋子绘制
└── <script>
    ├── api.js       封装所有后端请求（createGame / makeMove / undo / reset）
    ├── renderer.js  棋盘渲染（drawBoard / drawStone / drawWinHighlight）
    ├── state.js     本地状态镜像（currentPlayer / board / history）
    └── events.js    用户交互（click / mousemove / 按钮事件）
```

### 3.3 页面布局

```
┌──────────────────────────────────────┐
│           网页版五子棋                │
├──────────────────────────────────────┤
│  ● 黑棋落子中…  /  ○ 白棋落子中…     │  ← 状态栏
├──────────────────────────────────────┤
│                                      │
│           15×15 棋盘（Canvas）        │
│                                      │
├──────────────────────────────────────┤
│     [悔棋]           [重新开始]       │
└──────────────────────────────────────┘
```

### 3.4 前端数据模型

```js
// 棋盘：0=空, 1=黑棋, 2=白棋
board[row][col] = 0 | 1 | 2

const BOARD_SIZE = 15;
const CELL_SIZE  = 40;   // px
const PADDING    = 40;   // px
```

---

## 4. 后端设计

### 4.1 技术栈

| 层次 | 技术 |
|------|------|
| 运行时 | Node.js 18+ |
| Web 框架 | Express 4 |
| 数据存储 | 内存 Map（开发） / SQLite（生产） |
| 测试框架 | Jest + Supertest |

### 4.2 目录结构

```
server/
├── server.js          Express 入口，注册路由
├── routes/
│   └── game.js        游戏相关路由定义
├── services/
│   └── gameService.js 业务逻辑（落子、胜负判断、悔棋）
├── store/
│   └── gameStore.js   数据存储（内存 Map）
└── tests/
    ├── gameService.test.js   单元测试
    └── gameApi.test.js       集成测试
```

### 4.3 RESTful API 设计

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/api/games` | 创建新游戏，返回 gameId |
| `GET`  | `/api/games/:id` | 获取游戏当前状态 |
| `POST` | `/api/games/:id/move` | 落子 |
| `POST` | `/api/games/:id/undo` | 悔棋（撤销上一步） |
| `POST` | `/api/games/:id/reset` | 重置游戏 |
| `GET`  | `/api/games/:id/history` | 获取落子历史记录 |

### 4.4 数据结构

**游戏状态（Game Object）**

```json
{
  "id": "uuid-v4",
  "board": [[0,0,...],[...],...],
  "currentPlayer": 1,
  "status": "playing | black_win | white_win | draw",
  "winner": null,
  "winningCells": [],
  "history": [
    { "row": 7, "col": 7, "player": 1, "seq": 1 }
  ],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**落子请求体**

```json
{ "row": 7, "col": 7 }
```

**通用响应格式**

```json
{
  "success": true,
  "data": { ... },
  "message": ""
}
```

**错误响应格式**

```json
{
  "success": false,
  "error": "INVALID_MOVE",
  "message": "该位置已有棋子"
}
```

### 4.5 胜负判断算法

沿四个方向（水平、垂直、主对角、副对角）双向计数同色连续棋子，若 ≥ 5 则判胜：

```
方向向量：[0,1]  [1,0]  [1,1]  [1,-1]
对每个方向：正向计数 + 反向计数 - 1 ≥ 5 → 获胜
```

---

## 5. 主要功能需求及测试用例

---

### F1：创建游戏

**描述**：用户进入页面或点击「重新开始」时，向后端发起创建游戏请求，后端返回唯一 gameId，前端初始化棋盘。

#### 单元测试

| 用例编号 | 用例名称 | 前置条件 | 操作步骤 | 预期结果 |
|---------|---------|---------|---------|---------|
| UT-F1-01 | 创建游戏返回合法 ID | 服务正常运行 | 调用 `gameService.createGame()` | 返回含 `id`（UUID）、`board`（15×15 全零数组）、`currentPlayer=1`、`status="playing"` 的对象 |
| UT-F1-02 | 棋盘初始状态全为空 | 已创建游戏 | 遍历 `game.board` | 所有 225 个格子值均为 0 |
| UT-F1-03 | 黑棋默认先手 | 已创建游戏 | 读取 `game.currentPlayer` | 值为 1（黑棋） |
| UT-F1-04 | 多次创建游戏 ID 唯一 | 服务正常运行 | 连续调用 `createGame()` 10 次 | 所有 ID 互不相同 |

#### 集成测试（API）

| 用例编号 | 用例名称 | 请求 | 预期响应 |
|---------|---------|------|---------|
| IT-F1-01 | POST /api/games 成功 | `POST /api/games` | HTTP 201，body 包含 `success:true`、`data.id`、`data.status="playing"` |
| IT-F1-02 | 响应棋盘格式正确 | `POST /api/games` | `data.board` 为长度 15 的数组，每个子数组长度为 15 |

---

### F2：落子

**描述**：轮到己方时，玩家点击棋盘空格交叉点落子；后端验证合法性后更新棋盘状态，回合自动切换。

#### 单元测试

| 用例编号 | 用例名称 | 前置条件 | 操作步骤 | 预期结果 |
|---------|---------|---------|---------|---------|
| UT-F2-01 | 合法落子成功 | 已创建游戏 | 调用 `makeMove(game, 7, 7)` | `board[7][7]=1`，`currentPlayer` 切换为 2 |
| UT-F2-02 | 重复落子被拒绝 | 已在 (7,7) 落子 | 再次调用 `makeMove(game, 7, 7)` | 抛出 `INVALID_MOVE` 错误 |
| UT-F2-03 | 越界落子被拒绝 | 已创建游戏 | 调用 `makeMove(game, -1, 0)` | 抛出 `OUT_OF_BOUNDS` 错误 |
| UT-F2-04 | 越界落子被拒绝（超上限） | 已创建游戏 | 调用 `makeMove(game, 15, 0)` | 抛出 `OUT_OF_BOUNDS` 错误 |
| UT-F2-05 | 游戏结束后不能落子 | 已判定胜负 | 调用 `makeMove(game, 0, 0)` | 抛出 `GAME_OVER` 错误 |
| UT-F2-06 | 回合交替正确 | 已创建游戏 | 连续落子 3 次（不同位置） | 第1步后 `currentPlayer=2`，第2步后=1，第3步后=2 |

#### 集成测试（API）

| 用例编号 | 用例名称 | 请求 | 预期响应 |
|---------|---------|------|---------|
| IT-F2-01 | 合法落子 200 | `POST /api/games/:id/move` body: `{row:7,col:7}` | HTTP 200，`data.board[7][7]=1`，`data.currentPlayer=2` |
| IT-F2-02 | 重复落子 400 | 同一位置再次落子 | HTTP 400，`error="INVALID_MOVE"` |
| IT-F2-03 | 越界落子 400 | body: `{row:-1,col:0}` | HTTP 400，`error="OUT_OF_BOUNDS"` |
| IT-F2-04 | 缺少参数 400 | body: `{row:7}` | HTTP 400，`error="BAD_REQUEST"` |
| IT-F2-05 | 游戏不存在 404 | `POST /api/games/nonexistent/move` | HTTP 404，`error="GAME_NOT_FOUND"` |

---

### F3：胜负判断

**描述**：每次落子后，后端自动检测是否有一方连成五子（横/竖/斜），若是则更新 `status` 并标记获胜棋子坐标。

#### 单元测试

| 用例编号 | 用例名称 | 前置条件 | 操作步骤 | 预期结果 |
|---------|---------|---------|---------|---------|
| UT-F3-01 | 横向五连判胜 | 已创建游戏 | 在第 7 行第 3~7 列依次落黑棋 | `status="black_win"`，`winner=1` |
| UT-F3-02 | 纵向五连判胜 | 已创建游戏 | 在第 3~7 行第 7 列依次落黑棋 | `status="black_win"`，`winner=1` |
| UT-F3-03 | 主对角线五连判胜 | 已创建游戏 | 在 (3,3)(4,4)(5,5)(6,6)(7,7) 落黑棋 | `status="black_win"`，`winner=1` |
| UT-F3-04 | 副对角线五连判胜 | 已创建游戏 | 在 (3,7)(4,6)(5,5)(6,4)(7,3) 落黑棋 | `status="black_win"`，`winner=1` |
| UT-F3-05 | 四子不判胜 | 已创建游戏 | 在第 7 行第 3~6 列落黑棋 | `status="playing"`，`winner=null` |
| UT-F3-06 | 白棋获胜判断正确 | 已创建游戏 | 白棋在某行连续落子 5 个 | `status="white_win"`，`winner=2` |
| UT-F3-07 | 获胜棋子坐标返回正确 | 黑棋横向五连 | 检查 `winningCells` | 包含5个正确坐标 `[{row,col},...]` |
| UT-F3-08 | 棋盘满且无胜者判平局 | 已创建游戏 | 构造满棋盘无五连状态 | `status="draw"` |

#### 集成测试（API）

| 用例编号 | 用例名称 | 请求 | 预期响应 |
|---------|---------|------|---------|
| IT-F3-01 | 落子获胜响应正确 | 模拟黑棋连落 5 子最后一步 | HTTP 200，`data.status="black_win"`，`data.winningCells.length=5` |
| IT-F3-02 | 获胜后再落子被拒 | 获胜后继续 POST move | HTTP 400，`error="GAME_OVER"` |

---

### F4：悔棋

**描述**：玩家可撤销上一步落子，棋盘回到上一步状态，回合也恢复到上一步的玩家。

#### 单元测试

| 用例编号 | 用例名称 | 前置条件 | 操作步骤 | 预期结果 |
|---------|---------|---------|---------|---------|
| UT-F4-01 | 悔棋成功还原棋盘 | 已在 (7,7) 落黑棋 | 调用 `undo(game)` | `board[7][7]=0`，`currentPlayer=1` |
| UT-F4-02 | 悔棋历史记录减少 | 已落 3 步 | 调用 `undo(game)` | `history.length=2` |
| UT-F4-03 | 无历史时悔棋被拒 | 新建游戏未落子 | 调用 `undo(game)` | 抛出 `NO_HISTORY` 错误 |
| UT-F4-04 | 胜负已定后可悔棋 | 黑棋已五连获胜 | 调用 `undo(game)` | `status` 恢复为 `"playing"`，`winner=null` |
| UT-F4-05 | 多次悔棋正确 | 已落 5 步 | 连续调用 `undo()` 3 次 | 棋盘还原到第 2 步后的状态 |

#### 集成测试（API）

| 用例编号 | 用例名称 | 请求 | 预期响应 |
|---------|---------|------|---------|
| IT-F4-01 | 悔棋 200 | `POST /api/games/:id/undo` | HTTP 200，棋盘中上一步落子位置恢复为 0 |
| IT-F4-02 | 无历史悔棋 400 | 新游戏直接 POST undo | HTTP 400，`error="NO_HISTORY"` |

---

### F5：重置游戏

**描述**：点击「重新开始」后，游戏回到初始状态：棋盘清空、黑棋先手、历史记录清除。

#### 单元测试

| 用例编号 | 用例名称 | 前置条件 | 操作步骤 | 预期结果 |
|---------|---------|---------|---------|---------|
| UT-F5-01 | 重置后棋盘全空 | 已落若干步 | 调用 `resetGame(game)` | `board` 所有格子为 0 |
| UT-F5-02 | 重置后黑棋先手 | 白棋回合时重置 | 调用 `resetGame(game)` | `currentPlayer=1` |
| UT-F5-03 | 重置后历史清空 | 已有落子历史 | 调用 `resetGame(game)` | `history.length=0` |
| UT-F5-04 | 重置后状态为 playing | 游戏已结束 | 调用 `resetGame(game)` | `status="playing"`，`winner=null` |

#### 集成测试（API）

| 用例编号 | 用例名称 | 请求 | 预期响应 |
|---------|---------|------|---------|
| IT-F5-01 | 重置游戏 200 | `POST /api/games/:id/reset` | HTTP 200，`data.board` 全零，`data.currentPlayer=1` |
| IT-F5-02 | 重置不存在游戏 404 | `POST /api/games/nonexistent/reset` | HTTP 404，`error="GAME_NOT_FOUND"` |

---

### F6：查询对局历史

**描述**：提供接口按序返回本局所有落子记录，供前端回放或调试使用。

#### 单元测试

| 用例编号 | 用例名称 | 前置条件 | 操作步骤 | 预期结果 |
|---------|---------|---------|---------|---------|
| UT-F6-01 | 历史记录顺序正确 | 已按顺序落子 3 步 | 读取 `game.history` | 数组长度 3，`seq` 字段依次为 1、2、3 |
| UT-F6-02 | 历史记录含玩家信息 | 已交替落子 2 步 | 读取 `game.history` | 第 1 步 `player=1`，第 2 步 `player=2` |

#### 集成测试（API）

| 用例编号 | 用例名称 | 请求 | 预期响应 |
|---------|---------|------|---------|
| IT-F6-01 | 查询历史 200 | `GET /api/games/:id/history` | HTTP 200，`data` 为有序数组，每项含 `row`/`col`/`player`/`seq` |
| IT-F6-02 | 新游戏历史为空 | 创建游戏后立即查询 | HTTP 200，`data=[]` |

---

## 6. 文件结构

```
/
├── index.html              前端单文件（HTML + CSS + JS）
├── server/
│   ├── server.js           Express 后端入口
│   ├── routes/
│   │   └── game.js         游戏路由
│   ├── services/
│   │   └── gameService.js  业务逻辑
│   ├── store/
│   │   └── gameStore.js    内存数据存储
│   └── tests/
│       ├── gameService.test.js
│       └── gameApi.test.js
├── package.json
└── design.md               本设计文档
```

---

## 7. 里程碑计划

| 阶段 | 内容 | 状态 |
|------|------|------|
| v0.1 | 前端棋盘渲染 + 本地落子 + 胜负判断 + 重置 | ✅ 完成 |
| v0.2 | 前端悔棋 + 悬停预览 | ✅ 完成 |
| v0.3 | 后端 REST API + 单元测试 + 集成测试 | ✅ 完成 |
| v0.4 | AI 对战（Minimax + Alpha-Beta 剪枝） | 📋 待开发 |
| v0.5 | 在线联机（WebSocket） | 📋 待开发 |
