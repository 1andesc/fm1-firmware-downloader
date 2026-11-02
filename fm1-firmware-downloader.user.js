// ==UserScript==
// @name         FM-1 Firmware Downloader and Flash Helper
// @namespace    fm1-firmware-downloader
// @version      1.1.0
// @description  Browse, verify, download, and launch installation of the latest FM-1 firmware from The Firmware Hub. Includes a native-recovery path for incompatible flash chips.
// @author       1andesc
// @homepageURL  https://github.com/1andesc/fm1-firmware-downloader
// @supportURL   https://github.com/1andesc/fm1-firmware-downloader/issues
// @updateURL    https://raw.githubusercontent.com/1andesc/fm1-firmware-downloader/main/fm1-firmware-downloader.user.js
// @downloadURL  https://raw.githubusercontent.com/1andesc/fm1-firmware-downloader/main/fm1-firmware-downloader.user.js
// @match        https://thefirmwarehub.com/*
// @match        https://www.thefirmwarehub.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(async () => {
  "use strict";

  const CATALOG_URL = "/catalog.json";
  const CACHE_KEY = "fm1-userscript-catalog-v1";
  const SITE_ORIGIN = location.origin;
  const active = new Set();
  let catalog = [];
  let root;
  let panel;
  let list;
  let search;
  let kind;
  let status;

  function element(tag, className = "", value = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value) node.textContent = value;
    return node;
  }

  function formatBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n)) return "Unknown size";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  function formatDate(value) {
    if (!value) return "Unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function getFileName(item) {
    const url = new URL(item.pkg, SITE_ORIGIN);
    const original = decodeURIComponent(url.pathname.split("/").pop() || `${item.id}.fwsc`);
    const safe = original.replace(/[^\p{L}\p{N}._+@()-]+/gu, "-").replace(/^-+|-+$/g, "");
    return /\.fwsc$/i.test(safe) ? safe : `${item.id}.fwsc`;
  }

  function getPackageUrl(item) {
    const url = new URL(item.pkg, SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN || !/\.fwsc(?:$|\?)/i.test(url.pathname + url.search)) {
      throw new Error("The catalogue returned an untrusted firmware URL.");
    }
    return url.href;
  }

  function showToast(message, tone = "", timeout = 5000) {
    if (!root) return;
    const toast = root.getElementById("fm1-toast");
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    if (timeout) showToast.timer = setTimeout(() => toast.classList.remove("show"), timeout);
  }

  function setStatus(message, tone = "") {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function readCache() {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      return saved && Array.isArray(saved.firmwares) ? saved : null;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // Cache failure does not affect downloading.
    }
  }

  function normalize(data) {
    const items = Array.isArray(data.firmwares) ? data.firmwares : [];
    return items.filter((item) =>
      item &&
      typeof item.id === "string" &&
      typeof item.pkg === "string" &&
      /\.fwsc(?:$|\?)/i.test(item.pkg)
    ).map((item) => ({ ...item })).sort((a, b) =>
      String(b.published || b.date || "").localeCompare(String(a.published || a.date || ""))
    );
  }

  async function loadCatalog(force = false) {
    setStatus("Loading the latest firmware catalogue…");
    try {
      const response = await fetch(`${CATALOG_URL}?t=${Date.now()}`, {
        cache: force ? "reload" : "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      catalog = normalize(data);
      if (!catalog.length) throw new Error("The catalogue contains no downloadable firmware.");
      writeCache(data);
      fillKinds();
      render();
      setStatus(`Catalogue: ${data.updated || "Unknown"} · ${catalog.length} firmware packages`, "ok");
      decorateCards();
    } catch (error) {
      const cached = readCache();
      if (cached) {
        catalog = normalize(cached);
        fillKinds();
        render();
        setStatus(`Online refresh failed; using the cached catalogue: ${error.message}`, "error");
      } else {
        setStatus(`Could not load the catalogue: ${error.message}`, "error");
      }
    }
  }

  function fillKinds() {
    if (!kind) return;
    const current = kind.value;
    const kinds = [...new Set(catalog.map((item) => String(item.kind || "")).filter(Boolean))].sort();
    kind.replaceChildren(new Option("All categories", ""));
    for (const item of kinds) kind.append(new Option(item, item));
    kind.value = kinds.includes(current) ? current : "";
  }

  function filteredItems() {
    const query = search.value.trim().toLocaleLowerCase("zh-CN");
    const selectedKind = kind.value;
    return catalog.filter((item) => {
      if (selectedKind && item.kind !== selectedKind) return false;
      if (!query) return true;
      const haystack = [
        item.name, item.id, item.author, item.version, item.product,
        item.what, item.repo, item.kind
      ].map((value) => String(value || "")).join(" ").toLocaleLowerCase("zh-CN");
      return query.split(/\s+/).every((term) => haystack.includes(term));
    });
  }

  function updateProgress(id, message, tone = "") {
    const rowStatus = list?.querySelector(`[data-status-id="${CSS.escape(id)}"]`);
    if (rowStatus) {
      rowStatus.textContent = message;
      rowStatus.dataset.tone = tone;
    }
  }

  function render() {
    if (!list) return;
    const items = filteredItems();
    list.replaceChildren();
    if (!items.length) {
      list.append(element("div", "fm1-empty", "No matching firmware found."));
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const row = element("article", "fm1-row");
      const main = element("div", "fm1-main");
      const heading = element("div", "fm1-heading");
      heading.append(
        element("strong", "fm1-name", item.name || item.id),
        element("span", "fm1-version", item.version || "")
      );
      const details = element(
        "div",
        "fm1-details",
        `${item.author || "Unknown author"} · ${item.product || "FM-1"} · ${formatBytes(item.size)} · ${formatDate(item.published || item.date)}`
      );
      const description = element("div", "fm1-description", item.what || "");
      const rowStatus = element("div", "fm1-row-status", active.has(item.id) ? "Downloading…" : "");
      rowStatus.dataset.statusId = item.id;
      main.append(heading, details, description, rowStatus);

      const actions = element("div", "fm1-actions");
      const flash = element("button", "fm1-flash", "Flash via Hub");
      flash.type = "button";
      flash.addEventListener("click", () => flashViaHub(item));
      const download = element("button", "fm1-download", active.has(item.id) ? "Downloading…" : "Download");
      download.type = "button";
      download.disabled = active.has(item.id);
      download.addEventListener("click", () => downloadFirmware(item, download));
      const copy = element("button", "fm1-copy", "Copy SHA");
      copy.type = "button";
      copy.disabled = !item.sha256;
      copy.addEventListener("click", () => copyHash(item.sha256));
      actions.append(flash, download, copy);
      row.append(main, actions);
      fragment.append(row);
    }
    list.append(fragment);
  }

  async function copyHash(hash) {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
    } catch {
      const area = document.createElement("textarea");
      area.value = hash;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    showToast("SHA-256 copied.", "ok");
  }

  async function sha256Hex(bytes) {
    if (!globalThis.crypto?.subtle) throw new Error("This browser cannot verify SHA-256.");
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function fetchVerified(item, onProgress) {
    const response = await fetch(getPackageUrl(item), { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
    const expected = Number(item.size || response.headers.get("content-length") || 0);
    const chunks = [];
    let received = 0;

    if (response.body && response.body.getReader) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        onProgress?.(received, expected);
      }
    } else {
      const value = new Uint8Array(await response.arrayBuffer());
      chunks.push(value);
      received = value.byteLength;
      onProgress?.(received, expected);
    }

    if (item.size && received !== Number(item.size)) {
      throw new Error(`File-size mismatch: received ${received} bytes; catalogue says ${item.size}.`);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const hash = await sha256Hex(bytes);
    if (item.sha256 && hash !== String(item.sha256).toLowerCase()) {
      throw new Error("SHA-256 verification failed. The file was not saved.");
    }
    return { bytes, hash };
  }

  function saveBytes(bytes, filename) {
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function downloadFirmware(item, button) {
    if (active.has(item.id)) return;
    active.add(item.id);
    if (button) {
      button.disabled = true;
      button.textContent = "Downloading…";
    }
    updateProgress(item.id, "Downloading…");
    showToast(`Downloading ${item.name || item.id}…`);

    try {
      const result = await fetchVerified(item, (received, total) => {
        const percent = total ? ` ${Math.min(100, Math.round(received / total * 100))}%` : "";
        updateProgress(item.id, `Downloading${percent} · ${formatBytes(received)}`);
        if (button) button.textContent = `Downloading${percent}`;
      });
      const filename = getFileName(item);
      saveBytes(result.bytes, filename);
      updateProgress(item.id, "SHA-256 verified.", "ok");
      showToast(`Downloaded and verified: ${filename}`, "ok", 6500);
    } catch (error) {
      updateProgress(item.id, error.message, "error");
      showToast(error.message, "error", 8000);
    } finally {
      active.delete(item.id);
      if (button) {
        button.disabled = false;
        button.textContent = "Download";
      }
      const direct = document.querySelector(`[data-fm1-direct-download="${CSS.escape(item.id)}"]`);
      if (direct) {
        direct.disabled = false;
        direct.textContent = "Download";
      }
    }
  }

  function monitorHubInstall(item, card) {
    const message = card.querySelector(".msg");
    if (!message) return;
    let last = "";
    const observer = new MutationObserver(() => {
      const current = message.textContent.trim();
      if (!current || current === last) return;
      last = current;
      if (/is on your FM-1|install OK/i.test(current)) {
        updateProgress(item.id, "Flashed successfully by The Firmware Hub.", "ok");
        showToast(`${item.name || item.id} was installed successfully.`, "ok", 8000);
        observer.disconnect();
      } else if (/disconnected after|did not appear|not found|failed|timeout|stopped/i.test(current)) {
        updateProgress(item.id, "Web flashing failed. Use the native M-Flasher recovery path.", "error");
        showToast(
          "Web flashing failed. If your FM-1 uses an alternate flash chip such as UC25HQ80, use Native recovery / M-Flasher.",
          "error",
          12000
        );
        observer.disconnect();
      }
    });
    observer.observe(message, { childList: true, characterData: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10 * 60 * 1000);
  }

  function flashViaHub(item) {
    const card = document.querySelector(`article.fw[data-id="${CSS.escape(item.id)}"]`);
    if (!card) {
      showToast("The Firmware Hub card for this package is not available.", "error");
      return;
    }
    const install = card.querySelector("button.go, a.go");
    if (!install) {
      showToast("This package does not expose a one-click Hub installer. Download it and use M-Flasher.", "error", 8000);
      return;
    }
    if (install.disabled) {
      showToast("The Hub installer is not ready. Connect the FM-1 and wait for detection, then try again.", "error", 7000);
      return;
    }
    panel.classList.remove("open");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    monitorHubInstall(item, card);
    showToast(`Starting The Firmware Hub installer for ${item.name || item.id}…`, "", 5000);
    install.click();
  }

  function decorateCards() {
    if (!catalog.length) return;
    for (const card of document.querySelectorAll("article.fw[data-id]")) {
      const id = card.dataset.id;
      const item = catalog.find((entry) => entry.id === id);
      if (!item || card.querySelector("[data-fm1-direct-download]")) continue;
      const links = card.querySelector(".links");
      if (!links) continue;
      const button = element("button", "fm1-direct-download", "Download");
      button.type = "button";
      button.dataset.fm1DirectDownload = id;
      button.style.cssText = [
        "font:600 13px/1.2 inherit",
        "color:var(--fg,#efe8e1)",
        "background:transparent",
        "border:1px solid var(--line,#3a3435)",
        "border-radius:8px",
        "padding:8px 12px",
        "cursor:pointer"
      ].join(";");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!active.has(id)) {
          button.disabled = true;
          button.textContent = "Downloading…";
          downloadFirmware(item, null);
        }
      });
      links.append(button);
    }
  }

  function createUI() {
    const host = document.createElement("div");
    host.id = "fm1-userscript-host";
    document.body.append(host);
    root = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; }
      button, input, select { font: inherit; }
      button { cursor: pointer; }
      .launcher {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483646;
        border: 1px solid #42f5f5; border-radius: 999px;
        padding: 12px 17px; color: #071311; background: #42f5f5;
        box-shadow: 0 10px 30px #0008; font: 800 13px/1 "Segoe UI", sans-serif;
        letter-spacing: .04em;
      }
      .panel {
        position: fixed; right: 20px; bottom: 72px; z-index: 2147483646;
        width: min(760px, calc(100vw - 24px)); height: min(720px, calc(100vh - 96px));
        display: none; grid-template-rows: auto auto auto minmax(0,1fr) auto;
        color: #efe8e1; background: #151213; border: 1px solid #4a4143;
        border-radius: 17px; overflow: hidden; box-shadow: 0 25px 80px #000c;
        font: 14px/1.5 "Segoe UI", sans-serif;
      }
      .panel.open { display: grid; }
      .head { display: flex; align-items: center; gap: 12px; padding: 15px 17px 11px; border-bottom: 1px solid #342e30; }
      .head b { font-size: 18px; color: #42f5f5; }
      .head small { color: #9f9792; margin-left: auto; }
      .close { width: 34px; height: 34px; border-radius: 50%; border: 1px solid #4a4143; background: #211d1e; color: #efe8e1; }
      .controls { display: grid; grid-template-columns: 1fr 150px auto; gap: 8px; padding: 12px 17px; }
      input, select {
        width: 100%; min-width: 0; color: #efe8e1; background: #0f0d0e;
        border: 1px solid #40393b; border-radius: 9px; padding: 9px 11px; outline: none;
      }
      input:focus, select:focus { border-color: #42f5f5; box-shadow: 0 0 0 3px #42f5f522; }
      .controls button, .actions button {
        color: #efe8e1; background: #282324; border: 1px solid #4a4143; border-radius: 9px; padding: 8px 12px;
      }
      .controls button:hover, .actions button:hover:not(:disabled) { border-color: #42f5f5; }
      .status { padding: 0 17px 9px; color: #aaa19c; font-size: 12px; }
      .status[data-tone="ok"] { color: #5fe3a1; }
      .status[data-tone="error"] { color: #ff7b88; }
      .list { overflow: auto; padding: 0 10px 10px; scrollbar-color: #4a4143 transparent; }
      .row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 12px; padding: 13px 8px; border-bottom: 1px solid #2c2729; }
      .heading { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
      .name { font-size: 16px; color: #fff; }
      .version { color: #afd9f4; font-size: 12px; }
      .details { margin-top: 3px; color: #9f9792; font-size: 12px; }
      .description { margin-top: 5px; color: #c8c0ba; font-size: 12px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .row-status { min-height: 17px; margin-top: 4px; color: #9f9792; font-size: 11px; }
      .row-status[data-tone="ok"] { color: #5fe3a1; }
      .row-status[data-tone="error"] { color: #ff7b88; }
      .actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
      .actions .flash { color: #ffc76b; border-color: #755d2e; font-weight: 700; }
      .actions .download { color: #071311; background: #42f5f5; border-color: #42f5f5; font-weight: 800; }
      .actions button:disabled { opacity: .45; cursor: not-allowed; }
      .empty { padding: 50px 15px; text-align: center; color: #9f9792; }
      .foot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; border-top: 1px solid #342e30; padding: 9px 17px; color: #827a76; font-size: 11px; }
      .foot .recovery { color: #ffc76b; font-weight: 700; }
      .toast {
        position: fixed; right: 20px; bottom: 74px; z-index: 2147483647;
        max-width: min(460px, calc(100vw - 40px)); padding: 11px 14px;
        color: #efe8e1; background: #141112f2; border: 1px solid #4a4143; border-radius: 11px;
        opacity: 0; transform: translateY(8px); pointer-events: none; transition: .18s ease;
        font: 13px/1.45 "Segoe UI", sans-serif;
      }
      .toast.show { opacity: 1; transform: none; }
      .toast[data-tone="ok"] { border-color: #246142; color: #5fe3a1; }
      .toast[data-tone="error"] { border-color: #73323a; color: #ff7b88; }
      @media (max-width: 620px) {
        .controls { grid-template-columns: 1fr 1fr; }
        .controls input { grid-column: 1 / -1; }
        .row { grid-template-columns: 1fr; }
        .actions { justify-content: flex-end; }
        .panel { right: 8px; width: calc(100vw - 16px); bottom: 64px; }
        .launcher { right: 12px; bottom: 12px; }
      }
    `;

    const launcher = element("button", "launcher", "FM-1 Firmware");
    launcher.type = "button";
    panel = element("section", "panel");
    panel.setAttribute("aria-label", "FM-1 Firmware Downloader and Flash Helper");

    const head = element("header", "head");
    const close = element("button", "close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    head.append(element("b", "", "FM-1 Firmware"), element("small", "", "The Firmware Hub"), close);

    const controls = element("div", "controls");
    search = element("input", "", "");
    search.type = "search";
    search.placeholder = "Search by name, author, version, or product";
    kind = element("select");
    kind.append(new Option("All categories", ""));
    const refresh = element("button", "", "Refresh");
    refresh.type = "button";
    controls.append(search, kind, refresh);

    status = element("div", "status", "Waiting for the catalogue…");
    list = element("div", "list");
    const foot = element("footer", "foot");
    foot.append(
      element("span", "", "Packages are fetched directly from thefirmwarehub.com and verified before saving."),
      element("span", "", "Unsupported web flashing?"),
      Object.assign(element("a", "recovery", "Native recovery / M-Flasher"), {
        href: "https://github.com/jvitkauskas/m-flasher/releases/latest",
        target: "_blank",
        rel: "noopener noreferrer"
      })
    );
    const toast = element("div", "toast");
    toast.id = "fm1-toast";

    panel.append(head, controls, status, list, foot);
    root.append(style, launcher, panel, toast);

    launcher.addEventListener("click", () => {
      panel.classList.toggle("open");
      if (panel.classList.contains("open")) search.focus();
    });
    close.addEventListener("click", () => {
      panel.classList.remove("open");
      launcher.focus();
    });
    search.addEventListener("input", render);
    kind.addEventListener("change", render);
    refresh.addEventListener("click", () => loadCatalog(true));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && panel.classList.contains("open")) {
        panel.classList.remove("open");
        launcher.focus();
      }
    });
  }

  function watchCards() {
    let timer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(decorateCards, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  createUI();
  watchCards();
  await loadCatalog(false);
})();
