# FM-1 Firmware Downloader and Flash Helper

A Tampermonkey / Violentmonkey userscript for The Firmware Hub that makes FM-1 firmware easier to browse, verify, download, and install.

It was built for FM-1 owners who can see firmware on the Hub but cannot complete installation because the web update path is incompatible with some flash chips. The script keeps the one-click Hub installer available and adds a clear native-recovery route through M-Flasher.

## Install the userscript

With Tampermonkey or Violentmonkey installed, open:

**<https://raw.githubusercontent.com/1andesc/fm1-firmware-downloader/main/fm1-firmware-downloader.user.js>**

Approve the installation when your userscript manager asks.

## Features

- Reads the latest public firmware catalogue from The Firmware Hub on every load.
- Adds a floating **FM-1 Firmware** panel to the Hub.
- Adds **Download** buttons directly to firmware cards.
- Searches by firmware name, ID, author, version, or product string.
- Filters by firmware category.
- Downloads the original `.fwsc` package without mirroring or modifying it.
- Verifies file size and SHA-256 in the browser before saving.
- Starts the Hub's own installer with **Flash via Hub**.
- Detects common web-flash failures and points to the native recovery path.
- Links directly to the latest M-Flasher release for hardware-incompatible update loaders.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) in Chrome or Edge.
2. Open the userscript install URL above.

3. Approve installation in the userscript manager.
4. Visit or refresh [thefirmwarehub.com](https://thefirmwarehub.com/).

The floating **FM-1 Firmware** button appears at the bottom-right of the Hub. Each firmware card also receives a **Download** button.

## How flashing works

The script does not reimplement the FM-1 update protocol. **Flash via Hub** invokes the original install button created by The Firmware Hub, so the page remains responsible for its own confirmation dialog, Web MIDI access, transfer, and progress display.

This keeps the script useful when the Hub's HTML changes:

- firmware metadata comes from `/catalog.json`;
- package URLs and hashes come from the same live catalogue;
- installation is delegated to the Hub's current installer;
- only the surrounding download and recovery workflow is added.

## When web flashing fails

Some FM-1 hardware revisions use an alternate flash chip. A common example is:

| Item | Value |
| --- | --- |
| Flash chip | UC25HQ80 |
| JEDEC ID | `0xB36014` |
| Flash size | 1 MiB |

Several custom update loaders only recognize the more common `0x856014` chip. On an unsupported unit, the web installer may:

- discover the FM-1 successfully;
- switch it into update mode;
- begin writing;
- disconnect after only a few read requests;
- return to the old firmware without completing the install.

Repeatedly pressing Install will not fix this. Use the native recovery path instead.

### Native recovery path with M-Flasher

[M-Flasher](https://github.com/jvitkauskas/m-flasher) communicates with the chip's built-in USB download mode instead of the incompatible firmware update loader.

1. Download the latest M-Flasher release for Windows, macOS, or Linux.
2. Connect the FM-1 directly to the computer with a USB **data** cable. Avoid unpowered hubs.
3. Start M-Flasher and let it find the unit.
4. **Back up the complete flash before writing anything.**
5. If the FM-1 is running, use M-Flasher's **Download Mode** action.
6. Use **Install firmware (.fwsc)** and select a package downloaded with this userscript.
7. Wait for M-Flasher to verify the write and restart the device.

Direct M-Flasher link:

<https://github.com/jvitkauskas/m-flasher/releases/latest>

On SLOOP, Felucca, or compatible forks, the device may also offer an emergency entry by holding the specified octave buttons while powering on. Follow the firmware's current documentation; the M-Flasher project is the authoritative source for its supported controls and recovery instructions.

## Safety

Firmware installation can overwrite the current firmware and data layout.

- Save your projects with the firmware's own editor when possible.
- Make a complete flash backup with M-Flasher before changing firmware.
- Do not unplug the FM-1 while it is writing.
- Verify the firmware is intended for the FM-1 and matches your hardware revision.
- Treat every downloaded third-party package as untrusted software. The script verifies integrity; it does not prove that the firmware itself is safe or suitable.
- A successful checksum proves the file matches the catalogue. It does not guarantee compatibility with a particular flash chip.

The catalogue currently provides SHA-256 values for firmware packages. The userscript checks those values before enabling a saved download.

## Privacy

The script has no analytics, telemetry, or remote code execution. It communicates only with:

- `thefirmwarehub.com` for the public catalogue and firmware packages;
- links you explicitly click, such as M-Flasher releases or a project page.

The script stores a cached copy of the firmware catalogue in the page's local storage so it can still display metadata when a refresh temporarily fails.

## Compatibility

- Chrome or Edge with Tampermonkey or Violentmonkey
- Desktop browsers
- The Firmware Hub's normal Web MIDI installer is still required for **Flash via Hub**
- A native tool such as M-Flasher is required when browser-based update loaders are incompatible with the installed flash chip

## Repository layout

```text
fm1-firmware-downloader.user.js  Main userscript
README.md                        Usage, flashing, and recovery guide
LICENSE                          MIT license
```

## Contributing

Bug reports and compatibility reports are welcome. Include:

- browser and userscript-manager versions;
- FM-1 firmware identity and flash JEDEC ID, if known;
- whether download verification succeeded;
- the exact message shown by The Firmware Hub;
- whether M-Flasher completed the install and verified the flash.

Never publish full flash backups. They may contain device identifiers, Bluetooth pairing data, projects, samples, and other personal data.

## License

This userscript is released under the MIT License.

The firmware packages remain the property of their respective authors and retain their own licenses. The Firmware Hub and M-Flasher are independent projects. This repository does not bundle or redistribute firmware images.

