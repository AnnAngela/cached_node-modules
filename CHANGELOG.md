# Changelog

## [7.0.0](https://github.com/AnnAngela/cached_node-modules/compare/v6.0.0...v7.0.0) (2026-06-20)


### ⚠ BREAKING CHANGES

* {NPM_VERSION*} magic variables removed. Use {PM_VERSION*} with \`packageManager: npm\` instead. Default cacheKey format changed from npm@{NPM_VERSION_MAJOR} to {PM}@{PM_VERSION_MAJOR}.
* update node engine requirement to ^24.11 in package.json
* update runtime to Node.js 24 in action.yaml

### npm

* update node engine requirement to ^24.11 in package.json ([b3d9c2d](https://github.com/AnnAngela/cached_node-modules/commit/b3d9c2d07cef161af4cf8d993cf2d17ec4bc8c45))
* update runtime to Node.js 24 in action.yaml ([1df7319](https://github.com/AnnAngela/cached_node-modules/commit/1df73191da57e0ffde61a63d007f7b460e116982))


### Features

* add pnpm and yarn support with vitest tests at 100% coverage ([#227](https://github.com/AnnAngela/cached_node-modules/issues/227)) ([9005a06](https://github.com/AnnAngela/cached_node-modules/commit/9005a064361666d933253607e2948902f0058b08))
* debug ([b4b210a](https://github.com/AnnAngela/cached_node-modules/commit/b4b210a7177d48ce0335952b62dde06f128cb201))
* init ([4bd96e3](https://github.com/AnnAngela/cached_node-modules/commit/4bd96e31486632b814cbc7fad49cdfd7f198a658))
* init ([44a6d0c](https://github.com/AnnAngela/cached_node-modules/commit/44a6d0c4f106dd5b41a26b09c7130ac34689f10b))
* new input and output ([d184afc](https://github.com/AnnAngela/cached_node-modules/commit/d184afc5590e501bde3f322aca672710d8d286dd))
* remove unnecessary fields in package-lock.json ([658f88f](https://github.com/AnnAngela/cached_node-modules/commit/658f88f825250c614af585a1746c6c66ad719028)), closes [#17](https://github.com/AnnAngela/cached_node-modules/issues/17)
* tag helper ([9a1da00](https://github.com/AnnAngela/cached_node-modules/commit/9a1da0010ba4cff73c4eb546073c3dfd2aa2fb7a))
* Update cache saving message ([2f59b5d](https://github.com/AnnAngela/cached_node-modules/commit/2f59b5d7c4874bdfa296f5baeeccacfd70afa00c))
* v1.0.1 ([a88bed5](https://github.com/AnnAngela/cached_node-modules/commit/a88bed5ec9f460e1063d6da2abbb8e46512d259b))
* 不必要的禁用 ([a5b7830](https://github.com/AnnAngela/cached_node-modules/commit/a5b7830b16e03bd1d5c8160578b51c16c6375378))
* 不等了=。= ([9d486f4](https://github.com/AnnAngela/cached_node-modules/commit/9d486f4e90959be4943ce22ec4631defa98ca11a))
* 优化大文件计算 hash ([2fa19f4](https://github.com/AnnAngela/cached_node-modules/commit/2fa19f476c500d591182f7269be1f0b4ac6befa6))
* 包裹日志 ([5c79d30](https://github.com/AnnAngela/cached_node-modules/commit/5c79d30d9e80ff77cff1476a4b80ef07d0042fab))
* 手动转换 ([fcad8cf](https://github.com/AnnAngela/cached_node-modules/commit/fcad8cf270bf8489a73b1a501d3fedad53e99123))
* 更新默认值 ([ac75bea](https://github.com/AnnAngela/cached_node-modules/commit/ac75beaa2604a70c01590bcce454b921d582e704))
* 添加 @types/shell-quote 类型定义并优化命令执行方式 ([f60c62b](https://github.com/AnnAngela/cached_node-modules/commit/f60c62b19e082b4ef7eaeb1082ff318973a86612))
* 添加 prepare-nodejs 钩子配置文件 ([8ab3417](https://github.com/AnnAngela/cached_node-modules/commit/8ab34176a5c2ea3aded1356622d107b6dac311c7))
* 添加多个模块以增强功能，包括 git 操作、临时目录创建、JSON 文件读写和日期格式化 ([b4b1325](https://github.com/AnnAngela/cached_node-modules/commit/b4b132546c2081f5299a046c28238a40d6094b98))
* 添加日志 ([710e6f7](https://github.com/AnnAngela/cached_node-modules/commit/710e6f76e7fa4439bf9f98261be35f8b68cb86a6))


### Bug Fixes

* Add network error handling in spawnChildProcess.js ([f1fb3be](https://github.com/AnnAngela/cached_node-modules/commit/f1fb3be92538cf700d1243e74315d40f820ae846))
* eslint ([d5ad460](https://github.com/AnnAngela/cached_node-modules/commit/d5ad460ed6a057e922d7148aff2fd311fa3efbd6))
* false relative path ([6f5f353](https://github.com/AnnAngela/cached_node-modules/commit/6f5f353f4f94ad5104eb0c9d38adead6febde64c))
* hook for copilot ([5355b60](https://github.com/AnnAngela/cached_node-modules/commit/5355b60cf311b589de17083f635638201b0a0e42))
* **package:** add banner for module imports in packaging script ([ff74e30](https://github.com/AnnAngela/cached_node-modules/commit/ff74e3073dfb8cecf86f6a805f09f8480b47384a))
* reference error ([82cca64](https://github.com/AnnAngela/cached_node-modules/commit/82cca64f62493093c5a4e1760967385e48b76a5f))
* rename to avoid problem ([c833bef](https://github.com/AnnAngela/cached_node-modules/commit/c833befa0b4ea1c8b0480cfc61643124c0ce66d8))
* **tsconfig:** 移除不必要的编译选项 ([9b3b943](https://github.com/AnnAngela/cached_node-modules/commit/9b3b9435fd5679c2d373202881436cfc827b6c85))
* use npm version to create and push git tags ([afbe0ea](https://github.com/AnnAngela/cached_node-modules/commit/afbe0ead9a191acce7641a847bffd7f41a9a8726))
* **workflows:** update permissions and clean up linter and publish YAML files ([3041ed9](https://github.com/AnnAngela/cached_node-modules/commit/3041ed9ad71a066684adad952c4cb07051e135bc))
* 优化 fetchFileGitCommitLong 函数，简化获取最新提交 SHA 的逻辑 ([584290f](https://github.com/AnnAngela/cached_node-modules/commit/584290fe9114b3ebf4e81bb5da5a968ff51f734e))
* 修复命令不在 cwd 执行的错误 ([a6e28b4](https://github.com/AnnAngela/cached_node-modules/commit/a6e28b4b1db45b3fd6ffec90738ac656ae5f6da8))
* 修改 variableFunction 类型参数名称为 _input ([52b8ace](https://github.com/AnnAngela/cached_node-modules/commit/52b8ace32738b5570b807718046c8917e80fc8b0))
* 函数化 ([e7ed9e2](https://github.com/AnnAngela/cached_node-modules/commit/e7ed9e2f3402c4707932f32550be67d9f61157ed))
* 更新 Node.js 版本要求至 ^22.11 ([d278b16](https://github.com/AnnAngela/cached_node-modules/commit/d278b161f3229ca2f2ec2112d03307f1dc19b93f))
* 更新 README.md 和 action.yaml，添加对 GitHub token 的说明 ([a172d98](https://github.com/AnnAngela/cached_node-modules/commit/a172d98d7e75e1c10f2f9541d4a0173ccfee7013))
* 添加 sha 参数以获取特定引用的文件提交信息 ([8279960](https://github.com/AnnAngela/cached_node-modules/commit/8279960da2fb94c17b7982b600951500d05b5b66))


### Reverts

* no good ([27598a4](https://github.com/AnnAngela/cached_node-modules/commit/27598a4052c4f1a7437fed0275a794fa1772f166))
* version ([b1caab6](https://github.com/AnnAngela/cached_node-modules/commit/b1caab6b4262c82490841f8c240aaac7ad5fab64))
