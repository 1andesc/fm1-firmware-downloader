<a id="english"></a>

**English** | [简体中文](#chinese)

# FM-1 Firmware Downloader and Flash Helper

A Tampermonkey / Violentmonkey userscript for [The Firmware Hub](https://thefirmwarehub.com/). It adds firmware search, verified downloads, one-click Hub flashing, and a native recovery route for incompatible flash chips.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open the **[userscript install link](https://raw.githubusercontent.com/1andesc/fm1-firmware-downloader/main/fm1-firmware-downloader.user.js)**.
3. Refresh The Firmware Hub.

## Features

- Reads the latest firmware catalogue on every visit.
- Adds search, category filters, and **Download** buttons to firmware cards.
- Verifies file size and SHA-256 before saving.
- **Flash via Hub** launches the Hub's native Web MIDI installer.
- Detects common web-flash failures and links to native recovery.

## Screenshots

![FM-1 firmware panel with download, flash, and recovery controls](docs/screenshots/download-flash-panel.png)

![Download buttons added to firmware cards](docs/screenshots/card-download-buttons.png)

## Recovery for web-flash failures

Some FM-1 units use an alternate flash chip, such as UC25HQ80 (`0xB36014`). Their firmware update loader may disconnect after a few write requests. This is not fixed by repeatedly pressing Install.

Use [M-Flasher](https://github.com/jvitkauskas/m-flasher/releases/latest) to access the chip's ROM download mode:

1. **Back up the complete flash first.**
2. Open **Download Mode**.
3. Choose **Install firmware (.fwsc)** and select the downloaded package.
4. Wait for verification and restart.

> **Persistent-storage warning:** A firmware can boot successfully and still be incompatible with the installed flash chip. It may accept presets or projects but keep them only in RAM, so they disappear after power-off. Save a test preset, power-cycle the FM-1, and verify it is still present. Check the flash JEDEC ID if storage behaves unexpectedly.

The script verifies that a file matches the catalogue, not that the firmware is compatible with every hardware revision or flash chip.

MIT licensed. No firmware images are bundled.

---

<a id="chinese"></a>

[English](#english) | **简体中文**

# FM-1 固件下载与刷写助手

这是一个适用于 [The Firmware Hub](https://thefirmwarehub.com/) 的 Tampermonkey / Violentmonkey 用户脚本，提供固件搜索、校验下载、网页刷写和不兼容闪存芯片的底层恢复路径。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)。
2. 打开 **[用户脚本安装链接](https://raw.githubusercontent.com/1andesc/fm1-firmware-downloader/main/fm1-firmware-downloader.user.js)**。
3. 刷新 The Firmware Hub。

## 功能

- 每次访问都读取最新固件目录。
- 增加搜索、分类筛选和卡片旁的 **Download** 按钮。
- 保存前校验文件大小和 SHA-256。
- **Flash via Hub** 调用网页自带的 Web MIDI 刷写流程。
- 检测常见失败，并提供底层恢复入口。

## 界面预览

![FM-1 固件面板：下载、网页刷写与底层恢复](docs/screenshots/download-flash-panel.png)

![固件卡片旁的下载按钮](docs/screenshots/card-download-buttons.png)

## 网页刷写失败时

部分 FM-1 使用 UC25HQ80 等替代闪存芯片，例如 JEDEC ID `0xB36014`。更新加载器可能在少量写入请求后掉线，反复点击 Install 无法解决。

使用 [M-Flasher](https://github.com/jvitkauskas/m-flasher/releases/latest) 进入芯片底层下载模式：

1. **先完整备份闪存。**
2. 打开 **Download Mode**。
3. 点击 **Install firmware (.fwsc)** 并选择已下载的固件。
4. 等待校验完成并重启。

> **存储警告：** 固件能够刷入并正常启动，并不代表闪存芯片兼容。某些固件会接受预设或工程，但只在 RAM 中保存，关机后随即丢失。请保存一个测试预设，重启 FM-1 后确认它仍然存在；如果存储异常，应检查闪存 JEDEC ID。

脚本只能证明文件与网页目录一致，不能保证固件适配所有硬件版本或闪存芯片。

MIT 许可证。仓库不包含任何固件镜像。
