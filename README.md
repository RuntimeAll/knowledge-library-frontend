# 教学资料库管理端

数学与科学教学资料库的 Vue3 管理端，基于若依扩展。

- 本仓库：[knowledge-library-frontend](https://github.com/RuntimeAll/knowledge-library-frontend)
- 配套后端：[knowledge-library-server](https://github.com/RuntimeAll/knowledge-library-server)
- 在本仓库执行 `npm ci` 安装锁定依赖，`npm run dev -- --port 5173 --strictPort` 启动，`npm run build:prod` 构建。
- 开发代理对接本机后端8080，实际配置见 `vite.config.js`。工作区 `tools/start-frontend.ps1` 和 `tools/build-frontend.ps1` 提供已安装 Node 运行时选择。
- 环境文件只保存公开的页面/API路径配置；真实凭据、依赖安装目录和构建产物不提交。
- 本次初始化保留现有框架与业务代码历史，不代表云端部署或用户业务终审。

以下保留原若依框架说明及来源。

## 核心接口文档

登录页“查看核心接口文档”进入 `/api-docs`，无需登录；原“系统工具 → 系统接口”入口展示同一 Swagger 页面。文档只加载后端精选 `core` 分组，业务调用继续要求调用者自己的 Bearer Token 和权限。页面不读取管理端 Token；在 Swagger 的 Authorize 中输入 Token，刷新后重新授权。Swagger 的操作锚点会同步到外层地址，便于分享和刷新。

请求只发往当前站点的 `VITE_APP_BASE_API` 前缀：开发 `/dev-api`、预发布 `/stage-api`、正式 `/prod-api`。页面显示当前请求环境，不提供外部地址切换。开发代理随环境前缀转发到8080，并传递 `X-Forwarded-Prefix`；后端需正确处理可信反向代理的转发头。公开 `/api-docs` 不意味着整个管理后台或业务数据免鉴权。

正式站点需配置 HTTPS、SPA history fallback 与同源 API 代理，例如以下路径规则（域名、证书和服务地址由部署配置确定）：

```nginx
location /prod-api/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Prefix /prod-api;
}
location / {
    try_files $uri $uri/ /index.html;
}
```

公开入口、Swagger资源、`/prod-api/v3/api-docs/core`、授权请求均经同一站点；不要另开绕过前缀的全量 `/v3/api-docs` 代理。实际公网部署与外网验收须另行记录，构建成功不表示已发布。

## 前端增量质量检查

使用 Node `^20.19.0 || ^22.13.0 || >=24.0.0`，通过 `npm ci` 安装锁定依赖。ESLint 10 与 Vue essential 检查使用 flat 配置；自动导入全局名和 Vite 共享声明，新增代码仍应优先显式导入。

- `npm run lint`：扫描全部业务源码和构建/检查代码，阻断新增违规；不修改文件。
- `npm run lint:full`：直接显示全部历史与新增问题，存在历史问题时预期非零。
- `npm run test:quality`：验证JS/Vue规则实际生效、同源路径限制和历史基线不能豁免新增/修改行。
- `npm run build:prod`：生产构建；预发布使用 `npm run build:stage`。

`quality/eslint-baseline.json`固定PRD-009开始时的提交、源码哈希和406条历史问题的规则/位置/原因。检查器将原位置映射到当前未改动行；触达违规行、复制旧代码或新增文件不能沿用历史豁免。普通检查不刷新基线，没有自动更新命令；修复后可删除相应条目，扩大基线须有明确审查依据。静态检查不能替代分页、请求竞态和真实接口验收。

## 题目审查与恢复（PRD-010）

题库默认使用 NORMAL 范围，仅展示当前可用题。具备查询权限的账号可切换草稿、回收站、历史停用及全部维护记录；普通元数据保存不提供“正常”状态选项。详情中的检查面板承担批准、退回草稿、软删除、恢复及数量例外，服务端仍校验权限、版本和完整内容依据。退回与软删除明确区分“仅停用当前题”和“内容/来源有误”：前者保留既有派生，后者由后端将受影响的正常派生退回草稿，并在回执中列题号。编辑回流导出使用 MAINTENANCE，正式取出与专项选题使用 NORMAL。

审批请求先保存稳定操作编号与原版本；网络结果未知时按原请求查回。批审逐项显示成功、冲突、失败或待对账，只重试未确认项。未确认审批按当前账号隔离保存在本标签页 sessionStorage。HTML 上传在当前页面保留未知结果对应的原文件与提交标识，避免重试时换输入；已收到的导入批次可凭批次编号重新读取。

候选审核入口 `/knowledge/review/runs/:runId/candidates/:candidateKey` 只连接知识库代理，显示冻结候选、完整内容、来源位置与证据引用。FAKE 或过期候选不能新批；已有未确认请求即使候选服务读取失败仍能按原编号向知识库查回。原件通过候选 sourceId 读取来源的 assetIds，再使用既有资产权限入口；无权限、读取失败或没有原件时显示对应状态。缺少正式题号的候选数量例外不会伪造题目编号。

- `npm run test:review`：审批身份、部分成功恢复、结构化错误、旧响应隔离、计算数量/母题完整哈希和专项失效引用的行为测试，并读取相邻 backend 的真实 DTO/详情赋值源码校对关键 fixture 字段；该契约回归需在完整工作空间运行。
- `npm run test:review-ui`：无头 Chromium 页面回归，使用本工作空间根目录锁定的 Playwright 依赖与已安装浏览器。启动临时 Vite 端口，所有业务请求由测试夹具响应；不访问真实知识库、数据库或 OSS。截图进入工程 `.runtime/work/prd-010/frontend-ui/`。

隔离页面测试验证界面交互与请求契约，不替代后端真实权限、并发、导入事务或正式业务验收。

<p align="center">
	<img alt="logo" src="https://oscimg.oschina.net/oscnet/up-d3d0a9303e11d522a06cd263f3079027715.png">
</p>
<h1 align="center" style="margin: 30px 0 30px; font-weight: bold;">RuoYi v3.9.2</h1>
<h4 align="center">基于SpringBoot+Vue3前后端分离的Java快速开发框架</h4>
<p align="center">
	<a href="https://gitee.com/y_project/RuoYi-Vue/stargazers"><img src="https://gitee.com/y_project/RuoYi-Vue/badge/star.svg?theme=dark"></a>
	<a href="https://gitee.com/y_project/RuoYi-Vue"><img src="https://img.shields.io/badge/RuoYi-v3.9.2-brightgreen.svg"></a>
	<a href="https://gitee.com/y_project/RuoYi-Vue/blob/master/LICENSE"><img src="https://img.shields.io/github/license/mashape/apistatus.svg"></a>
</p>

## 平台简介

* 本仓库为前端技术栈 [Vue3](https://v3.cn.vuejs.org) + [Element Plus](https://element-plus.org/zh-CN) + [Vite](https://cn.vitejs.dev) 版本。
* 配套后端代码仓库地址[RuoYi-Vue](https://gitee.com/y_project/RuoYi-Vue) 或 [RuoYi-Vue-fast](https://gitcode.com/yangzongzhuan/RuoYi-Vue-fast) 版本。
* 阿里云折扣场：[点我进入](http://aly.ruoyi.vip)，腾讯云秒杀场：[点我进入](http://txy.ruoyi.vip)&nbsp;&nbsp;

# 版本对比

RuoYi-Vue 前端项目的三个主要演进版本，方便你直观对比其技术栈差异（并行开发维护）。

| 项目名称      | **RuoYi-Vue2** | **RuoYi-Vue3** | **RuoYi-Vue3-TypeScript**   |
| :---          | :---           | :---           | :---                        |
| **前端框架**  | Vue 2         | Vue 3          | Vue 3                       |
| **脚本语言**  | JavaScript    | JavaScript     | TypeScript                  |
| **构建工具**  | Vue CLI       | Vite           | Vite                        |
| **UI 组件库** | Element UI    | Element Plus   | Element Plus                |
| **状态管理**  | Vuex          | Pinia          | Pinia                       |
| **路由管理**  | Vue Router 3  | Vue Router 4   | Vue Router 4                |
| **核心特点**  | 1. 技术栈经典稳定<br>2. 社区资料丰富<br>3. 当前维护重心已转移 | 1. 现代前端技术栈<br>2. 开发体验与性能更优<br>3. 官方主推的活跃版本 | 1. 类型加持，减少沟通成本<br>2. 开发时有提示，效率更高<br>3. 多人协作企业级开发项目 |
| **仓库地址**  | [RuoYi-Vue2](https://gitcode.com/yangzongzhuan/RuoYi-Vue2) | [RuoYi-Vue3](https://gitcode.com/yangzongzhuan/RuoYi-Vue3) | [RuoYi-Vue3-TypeScript](https://gitcode.com/yangzongzhuan/RuoYi-Vue3/tree/typescript) |

## 前端运行

```bash
# 克隆项目
git clone https://github.com/yangzongzhuan/RuoYi-Vue3.git

# 进入项目目录
cd RuoYi-Vue3

# 安装依赖
yarn --registry=https://registry.npmmirror.com

# 启动服务
yarn dev

# 构建测试环境 yarn build:stage
# 构建生产环境 yarn build:prod
# 前端访问地址 http://localhost:80
```

## 内置功能

1.  用户管理：用户是系统操作者，该功能主要完成系统用户配置。
2.  部门管理：配置系统组织机构（公司、部门、小组），树结构展现支持数据权限。
3.  岗位管理：配置系统用户所属担任职务。
4.  菜单管理：配置系统菜单，操作权限，按钮权限标识等。
5.  角色管理：角色菜单权限分配、设置角色按机构进行数据范围权限划分。
6.  字典管理：对系统中经常使用的一些较为固定的数据进行维护。
7.  参数管理：对系统动态配置常用参数。
8.  通知公告：系统通知公告信息发布维护。
9.  操作日志：系统正常操作日志记录和查询；系统异常信息日志记录和查询。
10. 登录日志：系统登录日志记录查询包含登录异常。
11. 在线用户：当前系统中活跃用户状态监控。
12. 定时任务：在线（添加、修改、删除)任务调度包含执行结果日志。
13. 代码生成：前后端代码的生成（java、html、xml、sql）支持CRUD下载 。
14. 系统接口：根据业务代码自动生成相关的api接口文档。
15. 服务监控：监视当前系统CPU、内存、磁盘、堆栈等相关信息。
16. 缓存监控：对系统的缓存信息查询，命令统计等。
17. 在线构建器：拖动表单元素生成相应的HTML代码。
18. 连接池监视：监视当前系统数据库连接池状态，可进行分析SQL找出系统性能瓶颈。

## 在线体验

- admin/admin123  
- 陆陆续续收到一些打赏，为了更好的体验已用于演示服务器升级。谢谢各位小伙伴。

演示地址：http://vue.ruoyi.vip  
文档地址：http://doc.ruoyi.vip

## 演示图

<table>
    <tr>
        <td><img src="https://oscimg.oschina.net/oscnet/cd1f90be5f2684f4560c9519c0f2a232ee8.jpg"/></td>
        <td><img src="https://oscimg.oschina.net/oscnet/1cbcf0e6f257c7d3a063c0e3f2ff989e4b3.jpg"/></td>
    </tr>
    <tr>
        <td><img src="https://oscimg.oschina.net/oscnet/up-8074972883b5ba0622e13246738ebba237a.png"/></td>
        <td><img src="https://oscimg.oschina.net/oscnet/up-9f88719cdfca9af2e58b352a20e23d43b12.png"/></td>
    </tr>
    <tr>
        <td><img src="https://oscimg.oschina.net/oscnet/up-39bf2584ec3a529b0d5a3b70d15c9b37646.png"/></td>
        <td><img src="https://oscimg.oschina.net/oscnet/up-936ec82d1f4872e1bc980927654b6007307.png"/></td>
    </tr>
	<tr>
        <td><img src="https://oscimg.oschina.net/oscnet/up-b2d62ceb95d2dd9b3fbe157bb70d26001e9.png"/></td>
        <td><img src="https://oscimg.oschina.net/oscnet/up-d67451d308b7a79ad6819723396f7c3d77a.png"/></td>
    </tr>	 
    <tr>
        <td><img src="https://oscimg.oschina.net/oscnet/5e8c387724954459291aafd5eb52b456f53.jpg"/></td>
        <td><img src="https://oscimg.oschina.net/oscnet/644e78da53c2e92a95dfda4f76e6d117c4b.jpg"/></td>
    </tr>
	<tr>
        <td><img src="https://oscimg.oschina.net/oscnet/up-8370a0d02977eebf6dbf854c8450293c937.png"/></td>
        <td><img src="https://oscimg.oschina.net/oscnet/up-49003ed83f60f633e7153609a53a2b644f7.png"/></td>
    </tr>
	<tr>
        <td><img src="https://oscimg.oschina.net/oscnet/up-d4fe726319ece268d4746602c39cffc0621.png"/></td>
        <td><img src="https://oscimg.oschina.net/oscnet/up-c195234bbcd30be6927f037a6755e6ab69c.png"/></td>
    </tr>
    <tr>
        <td><img src="https://oscimg.oschina.net/oscnet/b6115bc8c31de52951982e509930b20684a.jpg"/></td>
        <td><img src="https://oscimg.oschina.net/oscnet/up-5e4daac0bb59612c5038448acbcef235e3a.png"/></td>
    </tr>
</table>


## 若依前后端分离交流群

QQ群： [![加入QQ群](https://img.shields.io/badge/已满-937441-blue.svg)](https://jq.qq.com/?_wv=1027&k=5bVB1og) [![加入QQ群](https://img.shields.io/badge/已满-887144332-blue.svg)](https://jq.qq.com/?_wv=1027&k=5eiA4DH) [![加入QQ群](https://img.shields.io/badge/已满-180251782-blue.svg)](https://jq.qq.com/?_wv=1027&k=5AxMKlC) [![加入QQ群](https://img.shields.io/badge/已满-104180207-blue.svg)](https://jq.qq.com/?_wv=1027&k=51G72yr) [![加入QQ群](https://img.shields.io/badge/已满-186866453-blue.svg)](https://jq.qq.com/?_wv=1027&k=VvjN2nvu) [![加入QQ群](https://img.shields.io/badge/已满-201396349-blue.svg)](https://jq.qq.com/?_wv=1027&k=5vYAqA05) [![加入QQ群](https://img.shields.io/badge/已满-101456076-blue.svg)](https://jq.qq.com/?_wv=1027&k=kOIINEb5) [![加入QQ群](https://img.shields.io/badge/已满-101539465-blue.svg)](https://jq.qq.com/?_wv=1027&k=UKtX5jhs) [![加入QQ群](https://img.shields.io/badge/已满-264312783-blue.svg)](https://jq.qq.com/?_wv=1027&k=EI9an8lJ) [![加入QQ群](https://img.shields.io/badge/已满-167385320-blue.svg)](https://jq.qq.com/?_wv=1027&k=SWCtLnMz) [![加入QQ群](https://img.shields.io/badge/已满-104748341-blue.svg)](https://jq.qq.com/?_wv=1027&k=96Dkdq0k) [![加入QQ群](https://img.shields.io/badge/已满-160110482-blue.svg)](https://jq.qq.com/?_wv=1027&k=0fsNiYZt) [![加入QQ群](https://img.shields.io/badge/已满-170801498-blue.svg)](https://jq.qq.com/?_wv=1027&k=7xw4xUG1) [![加入QQ群](https://img.shields.io/badge/已满-108482800-blue.svg)](https://jq.qq.com/?_wv=1027&k=eCx8eyoJ) [![加入QQ群](https://img.shields.io/badge/已满-101046199-blue.svg)](https://jq.qq.com/?_wv=1027&k=SpyH2875) [![加入QQ群](https://img.shields.io/badge/已满-136919097-blue.svg)](https://jq.qq.com/?_wv=1027&k=tKEt51dz) [![加入QQ群](https://img.shields.io/badge/已满-143961921-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=0vBbSb0ztbBgVtn3kJS-Q4HUNYwip89G&authKey=8irq5PhutrZmWIvsUsklBxhj57l%2F1nOZqjzigkXZVoZE451GG4JHPOqW7AW6cf0T&noverify=0&group_code=143961921) [![加入QQ群](https://img.shields.io/badge/已满-174951577-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=ZFAPAbp09S2ltvwrJzp7wGlbopsc0rwi&authKey=HB2cxpxP2yspk%2Bo3WKTBfktRCccVkU26cgi5B16u0KcAYrVu7sBaE7XSEqmMdFQp&noverify=0&group_code=174951577) [![加入QQ群](https://img.shields.io/badge/已满-161281055-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=Fn2aF5IHpwsy8j6VlalNJK6qbwFLFHat&authKey=uyIT%2B97x2AXj3odyXpsSpVaPMC%2Bidw0LxG5MAtEqlrcBcWJUA%2FeS43rsF1Tg7IRJ&noverify=0&group_code=161281055) [![加入QQ群](https://img.shields.io/badge/已满-138988063-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=XIzkm_mV2xTsUtFxo63bmicYoDBA6Ifm&authKey=dDW%2F4qsmw3x9govoZY9w%2FoWAoC4wbHqGal%2BbqLzoS6VBarU8EBptIgPKN%2FviyC8j&noverify=0&group_code=138988063) [![加入QQ群](https://img.shields.io/badge/已满-151450850-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=DkugnCg68PevlycJSKSwjhFqfIgrWWwR&authKey=pR1Pa5lPIeGF%2FFtIk6d%2FGB5qFi0EdvyErtpQXULzo03zbhopBHLWcuqdpwY241R%2F&noverify=0&group_code=151450850) [![加入QQ群](https://img.shields.io/badge/已满-224622315-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=F58bgRa-Dp-rsQJThiJqIYv8t4-lWfXh&authKey=UmUs4CVG5OPA1whvsa4uSespOvyd8%2FAr9olEGaWAfdLmfKQk%2FVBp2YU3u2xXXt76&noverify=0&group_code=224622315) [![加入QQ群](https://img.shields.io/badge/已满-287842588-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=Nxb2EQ5qozWa218Wbs7zgBnjLSNk_tVT&authKey=obBKXj6SBKgrFTJZx0AqQnIYbNOvBB2kmgwWvGhzxR67RoRr84%2Bus5OadzMcdJl5&noverify=0&group_code=287842588) [![加入QQ群](https://img.shields.io/badge/已满-187944233-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=numtK1M_I4eVd2Gvg8qtbuL8JgX42qNh&authKey=giV9XWMaFZTY%2FqPlmWbkB9g3fi0Ev5CwEtT9Tgei0oUlFFCQLDp4ozWRiVIzubIm&noverify=0&group_code=187944233) [![加入QQ群](https://img.shields.io/badge/已满-228578329-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=G6r5KGCaa3pqdbUSXNIgYloyb8e0_L0D&authKey=4w8tF1eGW7%2FedWn%2FHAypQksdrML%2BDHolQSx7094Agm7Luakj9EbfPnSTxSi2T1LQ&noverify=0&group_code=228578329) [![加入QQ群](https://img.shields.io/badge/已满-191164766-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=GsOo-OLz53J8y_9TPoO6XXSGNRTgbFxA&authKey=R7Uy%2Feq%2BZsoKNqHvRKhiXpypW7DAogoWapOawUGHokJSBIBIre2%2FoiAZeZBSLuBc&noverify=0&group_code=191164766) [![加入QQ群](https://img.shields.io/badge/已满-174569686-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=PmYavuzsOthVqfdAPbo4uAeIbu7Ttjgc&authKey=p52l8%2FXa4PS1JcEmS3VccKSwOPJUZ1ZfQ69MEKzbrooNUljRtlKjvsXf04bxNp3G&noverify=0&group_code=174569686) [![加入QQ群](https://img.shields.io/badge/已满-127358632-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=M9y5NjAl44lAL_Vh2crmEehZU_PMU6KS&authKey=ZSDz8hEREWSaPuxQV3gEwqGIaGjfRNnkB4rJjf0IvXhrSUGSGwQFmBA%2Boe8HFxyl&noverify=0&group_code=127358632) [![加入QQ群](https://img.shields.io/badge/113071109-blue.svg)](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=UGnoqRcFRxUaX-JAUNrSDbPimKrllp4x&authKey=Bbzf8Bc0XaQhq5c4QOg46Uqngd%2FvtIixrLvCM1EkPf41diqKXKZqXVwAxHTxJ8R1&noverify=0&group_code=113071109) 点击按钮入群。
