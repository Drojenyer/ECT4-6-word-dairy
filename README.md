# 英语四六级词汇学习平台

支持 Windows 桌面端和 Android 手机端的四六级词汇学习工具。学习词库与学习记录保存在本地；“帮你翻译”使用百度翻译 API，需要网络和有效的百度翻译开放平台凭据。

## 下载

前往 [Releases](https://github.com/Drojenyer/ECT4-6-word-dairy/releases/latest) 下载对应平台的安装包。

| 平台 | 使用方式 |
|------|----------|
| Windows | 解压后运行 `启动学习平台.bat`，或直接运行 `英语四六级词汇学习平台.exe` |
| Android | 安装 APK；如系统提示未知来源，按提示允许安装 |

Windows 学习进度保存在程序目录的 `user-data` 文件夹。将整个程序文件夹复制到另一台电脑可带走进度。Android 学习数据保存在应用内部，卸载应用会清除数据。

## 学习功能

- **三种学习模式**：看词选义、看义选词、词卡浏览。
- **断点续做**：答题进度自动保存，重开后可继续。
- **每日词量**：可选择 10 / 20 / 30 / 50 / 100 个，并设置是否排除已掌握词。
- **高频词默写**：根据中文释义拼写英文；音标默认隐藏，可随时显示。字母提示不会将单词计为真正掌握。
- **错题本**：支持排序、详细/网格显示和错词专项复习。重复答错的词会进入重点复习，多次答对后自动取消标记。
- **艾宾浩斯复习**：按 0 / 1 / 2 / 4 / 7 / 15 / 30 天安排复习，答错后回到第一阶段。
- **学习统计与提醒**：记录连续打卡、测验、正确率和学习时长；可设置每日提醒。

## 帮你翻译

独立翻译栏目可自动判断中文或英文，并翻译为另一种语言；支持复制结果和英文朗读。翻译需要联网，按停输入后自动请求百度通用翻译 API。

### Windows 配置

在程序主目录创建 `baidu-translate.local.json`，填写百度翻译开放平台中配套的 APP ID 和密钥：

```json
{
  "appId": "你的 APP ID",
  "apiKey": "你的密钥"
}
```

凭据文件只放在本地程序目录，不要提交到代码仓库或分享给他人。PC 界面不会显示密钥。

### Android 配置

在“帮你翻译”栏目输入 APP ID 和密钥。凭据只在当前应用会话中使用，不写入学习记录。

如遇到未授权、签名错误或额度用尽，请检查 APP ID 与密钥是否配套，以及百度翻译开放平台中的服务是否已开通。

## 外观

支持多种主题色、纯色与渐变背景、圆角、卡片密度和预设主题。Windows 桌面端还可在“设置 → 桌面与启动”选择顶部栏的默认样式、亚克力或透明背景效果；透明背景显示软件当前主题背景。

## 开发运行

### Windows 桌面端

```bash
npm install
npm start
npm run dev
```

构建便携版：

```bash
npm run pack-portable
node build-portable.js E:\目标目录
```

### Android

```bash
cd mobile
npm install
npm run dev
npm run build
npm run build:apk
```

`npm run build:apk` 需要 Android SDK 和 JDK 21。仓库也提供 GitHub Actions 工作流构建 APK。

## 项目结构

```text
├── main.js                 # Electron 主进程、Windows 系统能力、本地 API 与数据读写
├── src/
│   ├── index.html          # PC / Android 共用页面
│   ├── js/                 # 答题、界面、主题、翻译与接口适配
│   └── styles/             # 共用样式
├── data/                   # 四六级词库、音标、高频词数据
├── build-portable.js       # Windows 便携版打包
└── mobile/
    ├── src/                # Capacitor 接口、Dexie 数据库与启动流程
    ├── scripts/            # 同步共享 HTML 和词库
    └── android/            # Android 原生工程
```

PC 由 Electron 主进程和本地 JSON 数据服务运行；Android 复用页面与学习界面，通过 Capacitor 和 IndexedDB 保存数据。两端系统能力与数据适配层分别维护。
