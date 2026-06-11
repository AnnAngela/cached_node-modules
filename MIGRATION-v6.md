# 从 v5 迁移到 v6

> v6 新增了对 pnpm 和 Yarn 的支持，同时将魔法变量体系从 `NPM_*` 升级为通用的 `PM_*`。本文档帮助你安全地从 v5 升级。

## 快速浏览

| 方面 | v5 | v6 |
|------|----|----|
| 包管理器 | 仅 npm | npm / pnpm / yarn |
| 包管理器魔法变量 | `{NPM_VERSION}`, `{NPM_VERSION_MAJOR}` 等 | `{PM_VERSION}`, `{PM_VERSION_MAJOR}` 等 |
| 锁文件魔法变量 | 无（硬编码 `package-lock`） | `{LOCKFILE}` |
| `command` 默认值 | `npm ci` | 自动推导 |
| `lockfilePath` 默认值 | `package-lock.json` | 自动推导 |
| 未知变量处理 | 静默忽略 | 发出警告 |

---

## 迁移步骤

### 步骤 1：判断你的使用场景

检查你的 workflow 中是否**显式指定了 `cacheKey`**：

```yaml
# 场景 A：使用了默认 cacheKey（最常见）
- uses: AnnAngela/cached_node-modules@v5

# 场景 B：显式自定义了 cacheKey
- uses: AnnAngela/cached_node-modules@v5
  with:
    cacheKey: my-custom-key:{OS_NAME}:...

# 场景 C：显式自定义了 cacheKey 并使用了 {NPM_*} 变量
- uses: AnnAngela/cached_node-modules@v5
  with:
    cacheKey: cached_node-modules:{OS_NAME}:node@{NODE_VERSION_MAJOR}:npm@{NPM_VERSION_MAJOR}:...
```

### 步骤 2：按场景迁移

#### 场景 A：使用默认 cacheKey

**只需将版本号从 `@v5` 改为 `@v6`：**

```yaml
# 仅改这一行
- uses: AnnAngela/cached_node-modules@v6
```

> ⚠️ **注意**：升级后缓存键会改变（`package-lock` → `package-lock.json`），首次运行会**缓存 miss**，需要重新安装并创建新的缓存条目。这是预期行为，不影响后续运行。

#### 场景 B：自定义 cacheKey（不含 `{NPM_*}` 变量）

**通常只需改版本号。** 但如果你的 `cacheKey` 中硬编码了包管理相关文字，建议也更新为通用变量：

```yaml
# v5
- uses: AnnAngela/cached_node-modules@v5
  with:
    cacheKey: my-project:npm@10:{LOCKFILE_HASH_SHA2_256}

# v6（改进版 — 用 {PM} 替代硬编码的 npm）
- uses: AnnAngela/cached_node-modules@v6
  with:
    cacheKey: my-project:{PM}@{PM_VERSION_MAJOR}:{LOCKFILE_HASH_SHA2_256}
```

> ⚠️ 注意：修改 `cacheKey` 格式会让缓存键改变，首次运行会 miss。

#### 场景 C：自定义 cacheKey（含 `{NPM_*}` 变量）

**替换旧变量为新变量，或保留旧变量（会收到警告）：**

```yaml
# v5
- uses: AnnAngela/cached_node-modules@v5
  with:
    cacheKey: cached_node-modules:{OS_NAME}:npm@{NPM_VERSION_MAJOR}

# v6（推荐 — 替换为新变量）
- uses: AnnAngela/cached_node-modules@v6
  with:
    cacheKey: cached_node-modules:{OS_NAME}:{PM}@{PM_VERSION_MAJOR}
```

> `{NPM_*}` 变量在 v6 中仍然可用，但每次运行会发出 `::warning::` 警告。建议同时替换为 `{PM_*}`。

---

## 新增功能迁移

### 迁移到 pnpm

```yaml
- uses: pnpm/action-setup@v4

- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: pnpm  # 这个 cache 可以放心保留，与本 action 互补

- uses: AnnAngela/cached_node-modules@v6
  with:
    packageManager: pnpm  # ← 只需加这一行
```

Action 将自动：
- 查找 `pnpm-lock.yaml` 作为锁文件
- 使用 `pnpm install --frozen-lockfile` 安装依赖
- 在计算哈希时剥离 `snapshots` 和 `time` 等无关字段

### 迁移到 Yarn

```yaml
# Yarn Classic (v1) 或 Yarn Berry (v2+)
- uses: actions/setup-node@v4
  with:
    node-version: 20

- uses: AnnAngela/cached_node-modules@v6
  with:
    packageManager: yarn  # ← 自动识别 Classic 或 Berry
```

### 自定义 command / lockfilePath

v6 为 `command`、`lockfilePath` 提供了智能默认值，但你仍然可以覆盖：

```yaml
# 仅当你有特殊需求时才需要显式指定
- uses: AnnAngela/cached_node-modules@v6
  with:
    packageManager: pnpm
    command: pnpm install --no-frozen-lockfile  # 覆盖默认命令
    lockfilePath: subdir/pnpm-lock.yaml          # 覆盖默认锁文件路径
```

---

## 用户案例：常见迁移示例

### 案例 1：最简单的 npm 项目

```diff
- uses: AnnAngela/cached_node-modules@v5
+ uses: AnnAngela/cached_node-modules@v6
```

就改这一行。

### 案例 2：有自定义 cacheKey，且用了旧变量

```diff
- uses: AnnAngela/cached_node-modules@v5
+ uses: AnnAngela/cached_node-modules@v6
  with:
-   cacheKey: my-app:{OS_NAME}:node@{NODE_VERSION_MAJOR}:npm@{NPM_VERSION_MAJOR}:{LOCKFILE_HASH_SHA2_256}
+   cacheKey: my-app:{OS_NAME}:node@{NODE_VERSION_MAJOR}:{PM}@{PM_VERSION_MAJOR}:{LOCKFILE_HASH_SHA2_256}
```

### 案例 3：要迁移到 pnpm

```yaml
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with:
    node-version: 20

- uses: AnnAngela/cached_node-modules@v6
  with:
    packageManager: pnpm
```

### 案例 4：monorepo + pnpm

```yaml
- uses: AnnAngela/cached_node-modules@v6
  with:
    packageManager: pnpm
    cwd: packages/my-package  # 工作目录指向子包
```

---

## 输出变更

如果你有下游步骤解析 `steps.cache.outputs.variables` JSON，需要注意字段名可能变了：

```diff
# 之前 (v5)
- ${{ fromJson(steps.cache.outputs.variables).NPM_VERSION }}

# 之后 (v6)
+ ${{ fromJson(steps.cache.outputs.variables).PM_VERSION }}
```

或者更安全的方式：直接从 `outputs.cacheKey` 判断命中情况，或者使用 `outputs.cache-hit` 布尔值。

---

## 常见问题

### Q: 我不改 `cacheKey`，升级后缓存会命中吗？

会 miss。因为默认 `cacheKey` 中 `package-lock` 变成了 `package-lock.json`。首次运行 miss 是正常现象，Action 会重新安装依赖并保存新缓存。

### Q: 我想保持和 v5 完全一样的缓存键，可以吗？

可以。显式设置 `cacheKey` 为 v5 的默认值：

```yaml
- uses: AnnAngela/cached_node-modules@v6
  with:
    cacheKey: cached_node-modules:{OS_NAME}:node@{NODE_VERSION_MAJOR}_{NODE_ARCH}:npm@{NPM_VERSION_MAJOR}:package-lock@{LOCKFILE_GIT_COMMIT_SHORT}{CUSTOM_VARIABLE}
```

### Q: {NPM_VERSION} 还能用吗？

可以，但会收到 `::warning::` 警告。建议替换为 `{PM_VERSION}`。

### Q: 如何同时使用 npm 和 pnpm（不同 workflow）？

每个 workflow 分别指定 `packageManager`：

```yaml
# workflow-npm.yml
- uses: AnnAngela/cached_node-modules@v6
  with:
    packageManager: npm

# workflow-pnpm.yml
- uses: AnnAngela/cached_node-modules@v6
  with:
    packageManager: pnpm
```

### Q: 不同 packageManager 的缓存会冲突吗？

不会。默认 `cacheKey` 包含 `{LOCKFILE}` 变量（如 `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`），自动区分不同包管理器的缓存。

---

## 需要帮助？

- 查看 [README](./README.md) 了解所有可用魔法变量
- 查看 [CHANGELOG](./.cache/CHANGELOG.md) 了解完整变更列表
- 遇到问题请提交 [GitHub Issue](https://github.com/AnnAngela/cached_node-modules/issues)
