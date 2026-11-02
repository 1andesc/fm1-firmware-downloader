# UC25HQ80 / SLOOP 2.8.4 compatibility case report

[简体中文](#简体中文) · Case date: 2026-11-03 (Asia/Shanghai)

> Experimental, firmware-specific compatibility work. One user reported successful installation and saving. This is not a universal flasher fix, an upstream release, or a guarantee of recovery.

## Evidence and outcome

| Item | Recorded result |
| --- | --- |
| Device | M-VAVE FM-1, 1 MiB flash |
| Flash | UCUN UC25HQ80, actual device-reported JEDEC ID `0xB36014` |
| Starting firmware | Official V16; the user reported that saving worked |
| Original target | SLOOP 2.8.4; user reported web-update failures and RAM-only storage after native installation |
| Experimental version | `SLOOP 2.8.4 UC TEST`; package identity remains `FM-1_900` |
| Installation | User performed installation with M-Flasher 0.7.0 on Windows |
| Reviewed plan | 143 sectors, `0x004000`–`0x092FFF` inclusive; settings erase and package bootloader replacement both unchecked |
| User feedback | “成功刷入且具备保存功能” — installation succeeded and saving is available |
| Not established by that feedback | An explicitly documented USB-disconnected cold-power-cycle persistence test, long-term endurance, real-device web OTA, or brick recovery |

The installation settings above were visible in the user's review screenshot, before writing. They are a record of this case, not a substitute for checking another device's final plan. The user's feedback is a single-device report; the development environment was not connected to the device. Do not promote it into a claim that all UC25HQ80 units are qualified.

## Root cause found in the exact SLOOP source revision

Source: [`isod89/sloop-fm1` at `91f30182d9095e0ecdb43396554f2ce5a67df179`](https://github.com/isod89/sloop-fm1/tree/91f30182d9095e0ecdb43396554f2ce5a67df179).

Three paths accepted only `0x856014`:

- [`firmware/src/project.c`](https://github.com/isod89/sloop-fm1/blob/91f30182d9095e0ecdb43396554f2ce5a67df179/firmware/src/project.c): `persist_boot()` otherwise returns without enabling flash storage.
- [`firmware/loader/loader.c`](https://github.com/isod89/sloop-fm1/blob/91f30182d9095e0ecdb43396554f2ce5a67df179/firmware/loader/loader.c): the update loader's flash-known check.
- [`firmware/src/recovery.c`](https://github.com/isod89/sloop-fm1/blob/91f30182d9095e0ecdb43396554f2ce5a67df179/firmware/src/recovery.c): the application's USB recovery gate.

The fixed ID check explains why a native tool can install an application that subsequently refuses persistent storage. Web-update failures can have other causes too; a disconnect alone is not a diagnosis.

The [UC25HQ80 manufacturer datasheet v1.2](https://www.ucuntech.com/uploads/20220324/d8602ea203b2303c2162d067ce715c4c.pdf) identifies RDID `B3 60 14`, 256-byte pages, page program `02h`, 4 KiB erase `20h`, WREN `06h`, status `05h`, and fast read `0Bh`. These match the operations used by this driver. Matching specifications alone does not qualify actual electrical timing, XIP transitions, protection state or concurrent operation.

## Patch scope

The [source patch](../patches/sloop-2.8.4-uc25hq80.patch) adds a shared explicit predicate:

```c
return id == 0x856014u || id == 0xB36014u;
```

The three paths above use it. Unknown IDs, zero and all-ones read failures remain refused. The UI version gains `UC TEST`.

- Production firmware: 5 files, 23 added lines and 4 removed lines, including comments/includes/version text.
- Tests/harness: 6 additional changed or new files, not compiled into the device firmware.
- Main application: 571,776 → 571,832 bytes (+56).
- Wrapped update loader: 6,896 → 6,918 bytes (+22).
- Package: 610,052 → 610,074 bytes (+22); the application slot has fixed padding.

No edits were made to the low-level `fm1_flash.h` SPI driver, write ranges, page limits, erase/program timeouts, protection/status bits, project format, audio algorithms, Bluetooth support, or the device's bootloader.

The experimental package's first `0x4000` flash-image bytes match the original SLOOP package. That comparison is **not** proof of the device's bootloader contents; the native installation plan must preserve the actual device boot area.

### Reproduction

Apply the patch only to the pinned source commit, not blindly to the newest upstream tree:

```sh
git clone https://github.com/isod89/sloop-fm1.git
cd sloop-fm1
git checkout 91f30182d9095e0ecdb43396554f2ce5a67df179
git apply --check /path/to/sloop-2.8.4-uc25hq80.patch
git apply /path/to/sloop-2.8.4-uc25hq80.patch
# Prepare the toolchain and SDK as described in upstream BUILDING.md.
python3 tools/build.py
sh tests/uc_compat_tests.sh
```

Do not use `--release` to overwrite the experimental version label. Different build dates change `__DATE__` and therefore the resulting hashes.

## Build and test evidence

[Detailed build-time test report (Chinese)](sloop-2.8.4-uc25hq80-tests.zh-CN.md).

- The unmodified reconstruction's `ota.bin` matched the uploaded original byte-for-byte. The application differed only in five bytes of the `__DATE__` string (`Oct 30 2026` → `Nov  2 2026`).
- The three SDK package dependencies matched the upstream build script's expected SHA-256 values.
- Build, image/RAM bounds, package CRC checks and the RAM-code no-call check passed. The low-level flash driver source was unchanged.
- The independent focused suite exited 0: full 24-bit ID allowlist check, simulated NOR storage/torn writes, recovery, real persistence/project code on simulated NOR for `0xB36014`, unknown-chip no-write checks, OTA, loader and CLI installer tests.
- CLI installer, offline-site and web protocol tests independently exited 0.
- ASan/UBSan fuzz and ThreadSanitizer QUICK checks passed on independent reruns after fixing the test processes' runtime-library search paths.
- 182 golden audio renders were unchanged. Recorded host dual-core output comparisons passed.

**There was no all-green complete regression run.** Four static target-cost checks exceeded their stored budgets; the complete cost output was identical on an unmodified upstream rebuild. Three FM6 functions lacked budgets. The initial complete run also had missing sanitizer runtime libraries, then ended with exit 127 after the test script was edited while its shell was still running. That was a test-execution error, not evidence of a firmware failure or of a complete pass. The fixed focused suite and the listed independent checks were rerun; the entire suite was not rerun from start to finish. Optional/uncompleted tests are not counted as passing. No baseline was relaxed to hide failures.

### Artifact identification (binary not hosted here)

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Uploaded official `FM-1.fwsc` (`FM-1_016`) | 718196 | `d017fb65e70aca97ee29d944470c3515a74581df5c0576bf70de917c7b2b61d5` |
| Uploaded original `sloop-2.8.4.fwsc` | 610052 | `5a6a0843c868650dba6718cf85e43e719aec18c3dc5cc803c57c38b382158d4e` |
| Experimental SLOOP UC25HQ80 package | 610074 | `770df321f994951bb0a4849ef41f64693f2162d821a2a8b6aa47b3819fd92f21` |

The original SLOOP package passed the generic package CRC checker. That checker reported an `isd_config.ini` CRC mismatch for official V16, which has extra encoded configuration entries. This was not resolved into an official-format validation result and must **not** be described as proof that the official package was damaged.

## Settings, Bluetooth and backups

- **Also erase settings and Bluetooth pairings** is an extra data-erasure option, not an enable/disable switch for Bluetooth. Leaving it unchecked does not remove functionality.
- Clearing settings does not fix a firmware's flash-ID allowlist. Whether clearing is appropriate depends on the target firmware's migration guidance and the reviewed map; it is not automatically required for this patch.
- **Also put back the package's stock bootloader** was unchecked in this case. No bootloader replacement is required by the patch.
- SLOOP's [licensing document](https://github.com/isod89/sloop-fm1/blob/91f30182d9095e0ecdb43396554f2ce5a67df179/LICENSING.md) states that the firmware never enables the Bluetooth/Wi-Fi radio. This compatibility patch does not add radio support.
- Unchecked erase options do not make V16 data permanently safe: SLOOP and V16 use different data layouts, and later saves can overwrite old data.
- Keep a complete device-specific 1 MiB flash backup and its metadata before changing firmware. Reinstalling an official package is not the same as restoring prior data. Backups and unique device data should remain private.

## Web flashing is a separate compatibility problem

This userscript verifies catalogue downloads and launches the Hub installer. It does not query a physical flash ID, patch binaries, change the bootloader, or make arbitrary firmwares compatible.

A target package may carry its own update loader; that loader and the new application's persistence code both need support. A patched currently running application cannot guarantee that the next package will install or save. The appropriate long-term fix is upstream chip support plus explicitly identified compatible builds, not blind byte replacement during flashing.

No physical web OTA or recovery session on UC25HQ80 was demonstrated in this case. If normal firmware cannot enter ROM mode, additional hardware may be needed. The inspected [FM-1 Transporter revision](https://github.com/kurogedelic/FM-1-transporter/tree/a7fb5e8ac692c528f8ed29e325911a3f4b8111d6) targets RP2040/RP2350 and its Python write path expects `id=856014`; it is not an already-validated UC25HQ80 or ESP32-S3 recovery fallback.

## Licensing and privacy

The downloader userscript remains MIT licensed. The included SLOOP source patch preserves its upstream notices and is **GPL-3.0-only**, not covered by the downloader's MIT license; see [patch licensing](../patches/README.md) and the [GPL text](../patches/LICENSE-GPL-3.0.txt). No firmware binaries, SDK blobs, whole-flash backups, pairing records, calibration data, unique device IDs or private conversation links are uploaded with this report. A JEDEC part ID identifies a chip model, not an individual unit. This work is not endorsed by M-VAVE, SLOOP or The Firmware Hub.

---

## 简体中文

### 本次结论与证据边界

- 设备为 FM-1，实机工具显示 UC25HQ80、`0xB36014`、1 MiB；官方 V16 原先可以保存。
- 原版 SLOOP 2.8.4 的持久化入口、更新加载器、应用恢复入口都只接受 `0x856014`。本次在核对芯片手册后，共用白名单增加 `0xB36014`，并继续拒绝未知型号。
- 用户在 Windows M-Flasher 0.7.0 上操作，最终预览为 **143 个扇区、`0x004000`–`0x092FFF`**；额外清除设置与替换引导程序均未勾选。
- 用户随后反馈：“**成功刷入且具备保存功能**”。这是单台设备的使用反馈，不是开发环境直接操作实机的测试结果。
- **用户没有进一步明确记录拔掉 USB、完全断电后再加载项目的测试步骤和结果**。不能据此宣称完整断电持久化资格验证、网页 OTA 验证、长时间耐久或救砖验证已经通过。

### 修改规模

固件本体改动 5 个文件，新增 23 行、删除 4 行（含注释、include 和版本文字）。另有 6 个测试/脚本文件，不进入设备固件。主程序增加 56 字节，更新加载器增加 22 字节；由于主程序区域固定填充，最终包只增加 22 字节。

底层 SPI 驱动、地址布局、页边界、擦写超时、写保护位、项目格式、音源算法和实机引导程序都没有修改。保留原有 A/B 存储、CRC 和保存后读回校验。

[源码补丁](../patches/sloop-2.8.4-uc25hq80.patch)只适用于上文固定的 SLOOP 源码版本，不是所有 `.fwsc` 通用补丁。二进制没有上传到本仓库，本文列出的 SHA-256 仅用于识别本次文件。

### 测试与不足

针对性主机测试、包完整性检查、安装器/网页协议模拟、内存安全模糊测试补跑和线程检测补跑均有通过记录；这些测试的 SPI 闪存行为由 RAM 模型替代。

**完整回归没有全通过记录。** 四项静态性能预算告警在未修改上游也完全相同；首次完整运行另遇到动态库路径问题及运行中修改测试脚本引发的退出 127。随后独立补跑了固定针对测试集和相关检查，但没有从头重新完整执行全部测试。详细情况见[测试报告](sloop-2.8.4-uc25hq80-tests.zh-CN.md)，未完成的项目不计为通过。

### 取消“清除设置和蓝牙配对”不会关闭蓝牙

该选项只控制额外的数据擦除，不控制蓝牙功能。它不能修复芯片白名单，也不是本补丁的必需操作。是否清除旧设置应依据目标固件迁移说明和写入预览决定，不应一律勾选。

SLOOP 上游说明不启用蓝牙/Wi-Fi，本补丁也没有添加蓝牙支持。后续 SLOOP 保存仍可能覆盖 V16 的旧数据，因此必须保留完整备份。

### 不能“一次刷入、以后所有固件都自动兼容”

刷写工具能完成安装，不代表新应用能持久保存。下一固件自己的加载器和存储代码都要适配芯片。本用户脚本目前没有芯片检测或自动补丁功能；本次提交也不添加此类行为。网页自动选择兼容构建可以作为未来设计，但需要明确型号检测/选择和逐固件验证。

现成 ESP32-S3 救砖方案没有在本次验证；指定版本的 Transporter 也仍有旧芯片 ID 检查。不能把“有开发板”当成已经有可靠恢复路径，更不能承诺“不变砖”。

本报告不公开设备全片备份、唯一序列号、校准/配对数据或聊天链接。`0xB36014` 是通用芯片型号标识。报告中的截图观察只做文字记录，不上传原始截图。
