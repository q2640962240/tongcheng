# 白夜 App · 原生 App 云打包发布清单 v1.0

> 本文档是「Phase 8 · 上线发布」的可执行操作手册，面向 Android/iOS 两套打包。
> 配套文档：[PROJECT.md Phase 8](PROJECT.md) / [APP-STORE-CHECKLIST.md](APP-STORE-CHECKLIST.md) / [PRIVACY-POLICY.md](PRIVACY-POLICY.md)

---

## 0. 打包前置条件（Gate Checklist · 打勾才能进下一节）

- [ ] 0.1 代码基线：当前分支 `main/master` 无未提交改动；`git status` 干净
- [ ] 0.2 后端已部署到公网 HTTPS 域名，接口响应正常：
  ```bash
  curl -I https://api.baiye.example.com/api/health   # 期望 HTTP/2 200
  ```
- [ ] 0.3 客户端 BASE_URL 已切换到公网（二选一）：
  - A. 环境变量：`set VITE_API_BASE=https://api.baiye.example.com` 后重新构建
  - B. 改代码：`app/src/utils/request.js` 中的 `DEFAULT_BASE` 注释说明默认值
- [ ] 0.4 管理后台「配置中心」7 大模块全部「测试连通性 → 通过」：
  - 应用（含 geoProvider / geoKey 若启用逆地理）
  - 短信（aliyun 或 tencent 字段齐全）
  - 微信支付（enabled=true + appId/mchId/密钥/证书齐全）
  - 支付宝（enabled=true + appId/公私钥齐全）
  - OSS（provider=local 或 aliyun 字段齐全）
  - 推送（provider=jpush 或 getui + appId/masterSecret）
- [ ] 0.5 Jest 单元测试全部通过：
  ```bash
  cd server && npm test   # 期望 12 suites / 95+ tests / 0 failures
  ```
- [ ] 0.6 H5 构建校验通过（确保 Vue/Sass 无新报错）：
  ```bash
  cd app && npm run build:h5
  # 期望：app/dist/build/h5/index.html 可访问，无 500
  ```
- [ ] 0.7 证书准备好（见 §2 证书清单）

---

## 1. 代码离线资源包 · CLI 重新构建

```bash
# 建议每次云打包前重新生成一份干净的 App 离线资源，避免 HBuilder X 读取老缓存
cd app
# 清理旧产物
rm -rf dist/build/app
# 生成 App 离线资源（对应 HBuilder X → 发行 → 原生App-云打包 前的本地构建）
npm run build:app
# 预期输出：
#   dist/build/app/
#   ├── app-config.json
#   ├── app-view.js / app-view.css
#   ├── pages/              # 31 路由页面编译产物
#   └── static/             # 图片/字体
#
# 完整性自检（见 PROJECT.md Phase 8）：
#   文件数 ≈ 98+，大小 ≈ 5.4MB，无 0 字节文件
```

---

## 2. 证书 / 应用标识清单（Android + iOS 双套）

### 2.1 证书占位总表

| # | 平台 | 项目 | 生成方法 / 说明 | 建议值 / 占位 | 必填 |
|---|---|---|---|---|---|
| A1 | Android | 签名 Keystore 文件 | `keytool -genkey -v -keystore baiye-release.keystore -alias baiye -keyalg RSA -keysize 2048 -validity 10950`（30 年有效期）| `baiye-release.keystore` | ✅ |
| A2 | Android | Keystore 密码 | 生成时手动输入 | 建议 ≥12 位，字母+数字+特殊 | ✅ |
| A3 | Android | Alias | 同 keytool 的 `-alias` 参数 | `baiye` | ✅ |
| A4 | Android | Alias 密码 | 可与 Keystore 密码一致，或独立 | 同上 | ✅ |
| A5 | Android | 包名 (Application ID) | 公司反域名 | `com.baiye.app` | ✅ |
| A6 | Android | 目标 ABI | 上架主流市场只用 ARM | arm64-v8a + armeabi-v7a（默认） | ✅ |
| A7 | Android | 版本号 (versionCode) | 每次上架自增 +1 | 100 → 101 → ... | ✅ |
| A8 | Android | 版本名 (versionName) | 用户可见 | `1.0.0` → `1.0.1` → ... | ✅ |
| I1 | iOS | Apple Developer 账号 | Enrollment 年费 $99/年 | `your@company.com` | ✅ |
| I2 | iOS | Apple Distribution 证书 | Developer Portal → Certificates → 新增 → 下载 .cer → Keychain 导入 → 右键导出 .p12 | `baiye-dist.p12` | ✅ |
| I3 | iOS | .p12 密码 | Keychain 导出时设置 | ≥8 位，独立存档 | ✅ |
| I4 | iOS | App ID (Bundle ID) | Identifiers → App IDs → Register（启用 Push / Sign in with Apple / Universal Links 按需） | `com.baiye.app` | ✅ |
| I5 | iOS | App Store Provisioning Profile | Profiles → App Store → 绑定 I4 + I2 证书 → 下载 .mobileprovision | `baiye-appstore.mobileprovision` | ✅ |
| I6 | iOS | 开发阶段 Ad Hoc Profile（可选）| 用于真机测未上架包，设备需 UDID 白名单 | `baiye-adhoc.mobileprovision` | — |
| I7 | iOS | Transporter App 或 App 专用密码 | App Store Connect 上传用 | 从 appleid.apple.com → 安全 → 生成 | ✅（上传时） |

### 2.2 证书保存规范（团队必守）

- **绝对不入库**：所有 `.keystore / .p12 / .mobileprovision / 密码文本` 一律不放 git；用团队密钥管理器（1Password / Vault / 云盘加密目录）
- 建议在项目根目录维护一个 `.gitignore` 条目（已存在）：
  ```
  *.keystore
  *.jks
  *.p12
  *.mobileprovision
  *.mobileprovision
  CERTIFICATES.md
  ```
- 每次证书轮换（过期/人员离职）时同步更新密钥管理器的版本号与「生效日期 / 失效日期」

---

## 3. HBuilder X · 云打包实操步骤（Android APK）

### 3.1 准备

1. 启动 HBuilder X（建议 4.15+ 稳定版）
2. 文件 → 打开目录 → 选择 `d:\tongcheng\companion-play-app\app`（**必须选 app 子目录，不是项目根**）
3. 等待 HBuilder X 左下角显示项目类型 `uni-app(Vue3,Vite)`
4. 菜单 运行 → 清理缓存（消除上一次 Sass legacy-js-api deprecation 导致的缓存污染）

### 3.2 打开云打包面板

- 菜单 发行 → 原生App-云打包（或快捷键 Ctrl+U）

### 3.3 表单字段逐项填写

| 面板分区 | 字段 | 填写值 |
|---|---|---|
| 平台选择 | Android（打包成APK/AAB）| ✅ 勾选 |
| 平台选择 | iOS（打包成IPA）| 这节不勾，下一节单独打 |
| Android 证书 | 使用自有证书 | ✅ 选择；**禁止** DCloud 公共证书打正式包（仅用于测试）|
| Android 证书 | 证书文件 | 选 §2 A1 的 `baiye-release.keystore` |
| Android 证书 | 证书密码 | 填 §2 A2 |
| Android 证书 | 证书别名 (alias) | 填 §2 A3 (`baiye`) |
| Android 证书 | 别名密码 | 填 §2 A4 |
| Android 包名 | Application ID | 填 §2 A5 (`com.baiye.app`) |
| 打包类型 | 打正式包 | ✅ 勾选（打正式包才被应用市场接受）|
| ABI | 支持的 CPU 架构 | 勾选 `armeabi-v7a` + `arm64-v8a`；**不要**勾选 x86（国内市场几乎不需要）|
| 权限配置 | AndroidManifest 权限列表 | 保持 manifest.json 已声明的 7 项即可：INTERNET / STORAGE R&W / CAMERA / RECORD_AUDIO / VIBRATE / ACCESS_NETWORK_STATE |
| uni 统计 | 开通 DCloud uni 统计 | 默认即可，也可勾选「使用腾讯 X5 内核」等增值项 |
| 其他 | 渠道 | 正式上架留空；应用宝/小米/OPPO/vivo/华为 多渠道打多个包时填写 `yingyongbao / xiaomi / oppo / vivo / huawei`（manifest.json 增加 `channel` 字段）|

### 3.4 开始打包

1. 点击「打包」→ 弹出「提示：请确认已经阅读隐私政策…」→ 确认
2. 等待 3~8 分钟，云打包完成后 HBuilder X 控制台输出 APK 下载链接
3. 下载 APK 并本地保存为 `白夜-v1.0.0-100.apk`（版本+versionCode 后缀便于回滚）

### 3.5 打包后本地验证（必须通过，否则不提交市场）

```powershell
# Windows 上验证 APK 签名（需要 JDK 的 keytool）
keytool -printcert -jarfile 白夜-v1.0.0-100.apk
# 期望输出：
#   Owner: CN=白夜, OU=..., O=..., L=Beijing, ST=Beijing, C=CN
#   Issuer: 与 Owner 相同（自签）或 DCloud 测试签发

# 或用 apksigner（SDK build-tools）：
apksigner verify -v 白夜-v1.0.0-100.apk
# 期望：Verifies verified using v1 / v2 / v3 scheme at least one true

# 安装到实体机做 冒烟测试 12 条（见 §5）
```

---

## 4. HBuilder X · 云打包实操步骤（iOS IPA）

### 4.1 前两步同 Android §3.1 / §3.2

### 4.2 表单字段逐项填写

| 面板分区 | 字段 | 填写值 |
|---|---|---|
| 平台选择 | iOS（打包成IPA）| ✅ 勾选 |
| 证书类型 | iOS 发布证书 (.p12) | 选 §2 I2 的 `baiye-dist.p12` |
| 证书密码 | p12 密码 | 填 §2 I3 |
| Profile | Provisioning Profile 文件（发布版）| 选 §2 I5 的 `baiye-appstore.mobileprovision` |
| Bundle ID | Bundle Identifier | 必须与 Profile 一致，填 §2 I4 (`com.baiye.app`) |
| 打包类型 | 打正式包（App Store 发布）| ✅ 勾选 |
| 支持的设备 | iPhone / iPad / 通用 | 建议 只 iPhone（本产品是同城 App，iPad 体验不优先）|
| 推送 / 登录 / 支付 | SDK 配置 | 勾选对应模块：Push（极光/个推/ DCloud Push 按 §2.3 配置中心对齐）、Payment（微信/支付宝）、OAuth（微信登录/QQ登录/苹果登录 如需要） |
| 隐私描述 (Info.plist) | NSCameraUsageDescription | `需要使用相机进行头像上传、认证照片拍摄`（中文，上架被拒高发项！）|
| 隐私描述 | NSPhotoLibraryUsageDescription | `需要访问相册上传动态图片、组局封面` |
| 隐私描述 | NSMicrophoneUsageDescription | `需要使用麦克风进行聊天语音录制` |
| 隐私描述 | NSLocationWhenInUseUsageDescription | `需要使用您的位置进行同城服务匹配（可随时关闭）` |
| 隐私描述 | NSPhotoLibraryAddUsageDescription | `需要保存图片到相册用于保存动态图片` |

### 4.3 开始打包 + 下载 IPA

- 点击「打包」→ 等待 5~10 分钟 → 下载 `白夜-v1.0.0.ipa`

### 4.4 上传至 App Store Connect

方式 A（推荐，可视化）：
1. Mac 上从 App Store 安装「Transporter App」
2. 登录开发者 Apple ID
3. 选择 IPA → 上传 → 等待校验通过（2~10 分钟）
4. App Store Connect → 我的 App → 对应版本号出现在「构建版本」里

方式 B（命令行，CI 友好）：
```bash
# 需要先从 appleid.apple.com 生成「App 专用密码」
xcrun altool --upload-app -f 白夜-v1.0.0.ipa -t ios \
  -u dev@baiye.app -p xxxx-xxxx-xxxx-xxxx
```

---

## 5. 上架前 · 真机冒烟测试清单（12 条 · 发布前必过）

### 5.1 Android / iOS 通用 12 条

| # | 模块 | 测试步骤 | 通过标准 |
|---|---|---|---|
| S1 | 启动页 | 冷启动 App | 3 秒内进入首页 Tab1；白屏/黑屏 <0.5 秒；启动图含白夜 logo |
| S2 | 权限弹窗 | 首次启动 | 权限弹窗文案与 Info.plist 声明一致；点不允许不崩溃 |
| S3 | 定位降级 | 关闭系统定位 → 打开首页 → 点左上角城市 | 弹出「未授权定位，进入手动选择」→ 打开城市选择页；全国 382+ 城市可选 |
| S4 | 短信登录 | 点我的 → 登录/注册 → 填真实手机号 → 获验证码 → 登录 | 60 秒内收到短信（生产）；成功登录跳转回「我的」且头像/昵称显示 |
| S5 | 首页信息流 | 上下滑动 20 条服务卡 | 无 undefined / NaN；空态、加载态、错误态 三态均能正常渲染 |
| S6 | 搜索同义词 | 搜索 "LOL"、"王者"、"哄睡" | 分别命中英雄联盟 / 王者荣耀 / 助眠类 服务或动态 |
| S7 | 发布动态 | 发现 → 发布动态 → 选图 → 输入文字 → 发布 | 敏感词被拦截（如命中预设正则）；正常发布后动态广场立即出现自己的动态 |
| S8 | 组局报名 | 发现 → 同城组局 → 任一组局 → 报名 | 未登录弹登录守卫；报名成功后人数 +1 |
| S9 | 红包签到 | 发现 → 红包专区 → 签到 | 钻石增加；第二天变已签到；重复签到提示今日已签 |
| S10 | 下单流程 | 服务详情 → 立即下单 → 选时段 → 提交 | 未配置支付通道时给出「请联系管理员开通支付」中文提示；已配置时调用统一下单 → 拉起微信/支付宝 |
| S11 | 客服 | 我的 → 设置 → 联系客服 | 微信 ID 从配置中心读取；复制按钮工作 |
| S12 | 退出登录 & 会话恢复 | 设置 → 退出登录 → 杀进程 → 再打开 | 退出后 token 清除；再打开仍显示游客态（不出现假登录） |

### 5.2 Android 额外 3 条

| # | 测试项 | 通过标准 |
|---|---|---|
| SA1 | APK 覆盖安装 | 安装旧版 → 安装新版 → 打开 | 数据不丢；图标/版本号与 manifest 声明一致 |
| SA2 | 64 位校验 | 用 Google Play Console 的「发布前报告」或本地 `aapt dump badging` | arm64-v8a native lib 存在（国内主流市场均要求 64 位） |
| SA3 | 权限最小化 | 安装后系统 → 权限页 | 仅声明 manifest.json 中的 7 项，不出现意外权限 |

### 5.3 iOS 额外 3 条

| # | 测试项 | 通过标准 |
|---|---|---|
| SI1 | TestFlight 外部测试 | 上传构建 → 添加外部测试员 → 反馈 | 功能通过；无崩溃日志（Xcode → Window → Devices 查看 .ips） |
| SI2 | 支付合规 | 包含虚拟货币（钻石）/ 精英会员的 App | **重要：iOS 内购（IAP）必须启用。如果当前实现走微信/支付宝虚拟商品，会被 Guideline 3.1.1 拒绝。请业务方确认走 App Store 内购或改为实体/线下服务，否则请在提审前切换到 IAP 实现。** |
| SI3 | 定位描述合规 | 审核员测试「同城服务匹配」场景 | Info.plist 声明 `WhenInUse`；不做后台定位；关闭定位后功能可用（走手动选择），否则 Guideline 5.1.1 被拒 |

---

## 6. 应用市场提审前 · 资质材料清单

### 6.1 全平台通用

| 材料 | 说明 | 白夜占位 |
|---|---|---|
| 软件著作权（软著） | 国内上架必备；预计 1~2 个月下证 | 「白夜 同城陪伴平台 V1.0」 |
| App ICP 备案 | 2023 年新规后，国内应用市场 App 必须 ICP 备案 | `京ICP备XXXXXXXX号-1A`（示例） |
| 隐私政策 URL | 必须公网可访问、HTTPS、H5 页面 | 本仓库 `docs/PRIVACY-POLICY.md` 渲染后发布到官网 |
| 用户协议 URL | 同上 | — |
| 营业执照 | 企业资质 | 企业营业执照扫描件 |
| 联系人 / 客服电话邮箱 | — | §0.4 配置中心的客服信息 |

### 6.2 Android 各市场差异化清单（简要）

| 市场 | 差异化 | 建议 |
|---|---|---|
| 华为 AppGallery | 需要《增值电信业务经营许可证》若含付费内容 | 提前提交，审核周期 3~5 天 |
| 小米应用商店 | 同上；App 索索要软著一致 | 先填 App 详情，再点提交审核 |
| OPPO / vivo | 软著 + ICP 备案 | — |
| 应用宝（腾讯）| 实名认证 + 支付类额外资质 | — |
| 抖音 / 快手 | 内容类需额外内容安全承诺 | 提供敏感词过滤机制说明 + 举报流程 |

### 6.3 App Store Connect 提审元信息

| 字段 | 填写说明 |
|---|---|
| 名称 | 白夜 |
| 副标题 | 同城陪伴 · 陪玩陪聊 · 组局广场 |
| 描述 | 200~300 字，突出功能 + 不夸张承诺 |
| 关键词 | 同城,陪玩,组局,大神,开黑,哄睡,ASMR,陪伴（不超过 100 字符）|
| 分类 | 社交 Networking（主要） / 生活方式 Lifestyle（次要）|
| 分级 | 17+（用户生成内容 UGC + 虚拟商品充值是标配分级）|
| 审核备注 | 账号（若需要审核员用测试号体验）→ 请在 App Store Connect → 提审时创建专属内部「审核体验账号」，生命周期仅提审期间有效 |
| 截图 / 预览视频 | 6.5 寸 / 5.5 寸；推荐 6 张横纵或全竖版 |

---

## 7. 构建产物归档规范（交付后 6 个月可追溯）

```
baiye-release-1.0.0-100/
├── Android/
│   ├── 白夜-v1.0.0-100.apk
│   ├── mapping.txt              # ProGuard/R8 混淆映射（仅当启用混淆才会生成）
│   ├── baiye-release.keystore.SHA256.txt   # Keystore 指纹（便于 6 个月后继签）
│   └── README.txt               # 打包者/日期/提交哈希
├── iOS/
│   ├── 白夜-v1.0.0.ipa
│   ├── baiye-dist.p12.expiry.txt            # 证书到期日（通常 365 天，需提前 30 天轮换）
│   ├── baiye-appstore.mobileprovision       # Profile 备份，便于应急重签
│   └── dSYMs/                 # 如果开启 dSYMs=true，按 Crashlytics/Firebase 上传
├── H5/
│   └── h5-1.0.0.tar.gz        # 对应 H5 静态资源，同版本号
└── META.md                     # 交付说明（提交人 / 提交日期 / git commit hash / 变更日志）
```

指纹生成命令：
```powershell
# Keystore SHA256（用于应用市场登记 Android 签名）
keytool -list -v -keystore baiye-release.keystore -alias baiye -storepass YOUR_PASS
```

---

## 8. 常见失败 & 快速处理

| 现象 | 根因 | 处理方法 |
|---|---|---|
| HBuilder X 云打包失败 `Cannot find module '@dcloudio/...'` | 本地未执行 npm install 或 HBuilder X 缓存脏 | ① `cd app && npm install`；② 菜单 运行 → 清理缓存 |
| 云打包 Sass 警告 legacy-js-api / deprecation 几十条 | 本机 `sass` 版本太新，HBuilder X 自带编译链与本地 Vite 路径差异 | 不影响打包；仅当出现 500 样式错误时执行 运行 → 清理缓存 + 重构建 |
| APK 安装失败 `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | 测试包与正式包签名不同 | 卸载旧 APK → 重新安装新版 |
| IPA 上传成功但 App Store Connect 显示「Missing Compliance」| 未声明加密出口合规（App 用了 HTTPS/JWT，非自定义加密）| App Store Connect → 我的 App → 功能 → 加密 → 勾选「此 App 不使用自定义加密算法」 |
| iOS 3.1.1 被拒 | 虚拟商品（钻石/精英会员）走了微信/支付宝 | 改为 Apple IAP（内购）或申报实体/线下服务凭据 |
| iOS 5.1.1 被拒（位置权限）| 未说明用途或后台定位滥用 | Info.plist 声明改成「用于同城服务匹配，可随时关闭」；并在产品里提供设置 → 隐私 → 关闭位置权限的开关（本项目已在设置页实现位置降级）|
| Android 应用市场「非官方版本」提示 | 使用 DCloud 公共证书打包 | 必须换成 §2 自有证书再打一遍 |
| 登录后 401 / 接口 400 配置中心未设置 | 生产 BASE_URL 未切换或配置中心为空 | 回到 §0.2/0.3/0.4 逐项核对 |
| App 端聊天「无法加载消息」| 未配置 WebSocket 公网域名 + HTTPS/WSS | 生产后端 WSS 监听 443 /api/socket.io 或走反向代理 |

---

## 9. 交付后 · 运维关键参数（Phase 8 后跟进）

- 证书到期提醒日历提前 **30 天** 预警（iOS 证书 1 年，Android keystore 30 年，前者更需关注）
- 应用市场 ICP 备案年度续期（每年 1~3 月集中年审）
- 版本发布节奏：小版本（1.0.x）按需，大版本（1.x.0）每 2~3 个月
- 灰度策略（Android/iOS 通用）：1% → 5% → 20% → 100%，每档停留 ≥24 小时，观察崩溃率 <0.3% 再升级

---

**文档版本**：v1.0 · 2026-08-28
**配套**：PROJECT.md § Phase 8 ｜ APP-STORE-CHECKLIST.md v2 ｜ PRIVACY-POLICY.md v2
