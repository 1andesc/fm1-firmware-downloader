# SLOOP 2.8.4 UC25HQ80 experimental build

This release is an experimental compatibility build for an M-VAVE FM-1 that reports:

- flash part: UCUN UC25HQ80
- JEDEC ID: `0xB36014`
- capacity: 1 MiB

The user reported that the package installed and that project saving became available. This is a single-device field report, not a completed hardware qualification.

## What changed

The original SLOOP 2.8.4 revision checked only `0x856014` in:

- the application flash-persistence boot path;
- the update loader's recognized-chip check;
- the application recovery entry.

This build accepts both `0x856014` and `0xB36014`. Unknown IDs remain rejected.

Five production files changed by +23/−4 lines. The application grew by 56 bytes and the update loader by 22 bytes. Low-level SPI commands, flash layout, timeouts, protection bits, and project format were not changed.

## Verification

Host tests cover the allowlist, simulated NOR persistence, recovery, unknown-chip refusal, OTA, loader, and installer behavior. The golden audio renders are unchanged. See `TEST-REPORT.md` and the repository case report for passing and incomplete checks.

The broader regression suite did not finish with an all-green result. Four static target-cost checks exceeded stored budgets both with and without the patch, and the first complete run ended because of test-runtime environment and script errors. Focused tests were rerun independently and are not presented as a complete regression pass.

## Required acceptance test

1. Back up the whole 1 MiB flash with M-Flasher.
2. Install only on a unit that reports `0xB36014`.
3. Do not replace the bootloader.
4. Boot the device and verify `SLOOP 2.8.4 UC TEST`.
5. Save a simple test project.
6. Power off, disconnect USB, wait, restart, and reload the project.

Do not store important work until that test succeeds. Cold-power-cycle persistence was not explicitly documented in the field report.

## Files

- `sloop-2.8.4-UC25HQ80-EXPERIMENTAL.fwsc` — experimental package
- `SLOOP-2.8.4-UC25HQ80-EXPERIMENTAL-source.zip` — complete corresponding source
- `SLOOP-2.8.4-UC25HQ80-EXPERIMENTAL-full.zip` — source, binary, tests, sums, and evidence
- `README-READ-FIRST.zh-CN.md` — installation and rollback notes
- `TEST-REPORT.md` — test details and limitations
- `SHA256SUMS.txt` — artifact and source hashes

Experimental firmware SHA-256:

```text
770df321f994951bb0a4849ef41f64693f2162d821a2a8b6aa47b3819fd92f21
```

## Licensing

SLOOP code is GPL-3.0-only. This release includes the complete corresponding source and preserves the upstream notices and third-party licenses.

The downloader userscript remains MIT licensed. This firmware and the source patch are not covered by that MIT license.

This is not an official M-VAVE, SLOOP, or The Firmware Hub release.
