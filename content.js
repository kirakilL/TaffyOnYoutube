(() => {
  "use strict";

  const FALLBACK_TAFFY_IMAGE_URL = chrome.runtime.getURL("images/taffy.png");
  let taffyImageUrls = [FALLBACK_TAFFY_IMAGE_URL];
  let taffyAssetVersion = "fallback";
  let imageIndexBag = [];

  const YOUTUBE_THUMBNAIL_SELECTOR = [
    "ytd-thumbnail",
    "yt-thumbnail-view-model",
    "a.yt-lockup-view-model-wiz__content-image",
    "ytd-rich-grid-media ytd-thumbnail",
    "ytd-video-renderer ytd-thumbnail",
    "ytd-compact-video-renderer ytd-thumbnail"
  ].join(", ");

  const BILIBILI_THUMBNAIL_SELECTOR = [
    ".bili-video-card__image--wrap",
    ".bili-video-card__image",
    ".bili-video-card__cover",
    ".bili-cover-card__thumbnail",
    ".bili-cover-card__cover",
    ".video-card__image",
    ".video-card__cover",
    ".video-page-card-small .pic-box",
    ".video-page-card-small .pic",
    ".card-box .pic-box",
    ".card-box .pic",
    ".video-item .img",
    ".video-item .img-anchor",
    ".video-item .lazy-img",
    ".small-item .cover",
    ".rank-item .preview",
    ".rank-item .img",
    ".history-card__cover",
    ".fav-video-list__cover",
    "a[href*='/video/'][class*='cover']",
    "a[href*='/video/'][class*='pic']"
  ].join(", ");

  const BILIBILI_THUMBNAIL_HOST_SELECTOR = [
    ".bili-video-card__image--wrap",
    ".bili-cover-card__thumbnail",
    ".bili-cover-card__cover",
    ".video-card__image",
    ".video-card__cover",
    ".video-page-card-small .pic-box",
    ".card-box .pic-box",
    ".video-item .img-anchor",
    ".video-item .img",
    ".small-item .cover",
    ".rank-item .preview",
    ".rank-item .img",
    ".history-card__cover",
    ".fav-video-list__cover",
    "a[href*='/video/'][class*='cover']",
    "a[href*='/video/'][class*='pic']"
  ].join(", ");

  const THUMBNAIL_SELECTOR = [YOUTUBE_THUMBNAIL_SELECTOR, BILIBILI_THUMBNAIL_SELECTOR].join(", ");

  const DIRECT_THUMBNAIL_HOST_SELECTOR = [
    "ytd-thumbnail",
    "yt-thumbnail-view-model",
    "a.yt-lockup-view-model-wiz__content-image",
    BILIBILI_THUMBNAIL_HOST_SELECTOR
  ].join(", ");

  const YOUTUBE_SHORTS_CONTAINER_SELECTOR = [
    "ytd-rich-grid-slim-media",
    "ytd-reel-item-renderer",
    "ytd-reel-video-renderer",
    "ytd-shorts",
    "ytm-shorts-lockup-view-model"
  ].join(", ");

  const DEFAULT_SETTINGS = {
    enabled: true,
    size: 35,
    position: "random"
  };

  let settings = { ...DEFAULT_SETTINGS };
  let debounceId = 0;
  let steadyScanId = 0;

  function normalizeSettings(nextSettings) {
    const size = Number(nextSettings.size);
    const position = ["bottom-right", "bottom-left", "random"].includes(nextSettings.position)
      ? nextSettings.position
      : DEFAULT_SETTINGS.position;

    return {
      enabled: nextSettings.enabled !== false,
      size: Number.isFinite(size) ? Math.min(60, Math.max(20, size)) : DEFAULT_SETTINGS.size,
      position
    };
  }

  function getRandomSide(thumbnail) {
    if (!thumbnail.dataset.taffySide) {
      thumbnail.dataset.taffySide = Math.random() < 0.5 ? "left" : "right";
    }

    return thumbnail.dataset.taffySide;
  }

  function getRandomScale(thumbnail, slot = 0) {
    const key = `taffyScale${slot}`;

    if (!thumbnail.dataset[key]) {
      thumbnail.dataset[key] = (0.8 + Math.random() * 0.4).toFixed(3);
    }

    return Number(thumbnail.dataset[key]);
  }

  function getRandomRotation(thumbnail, slot = 0) {
    const key = `taffyRotation${slot}`;

    if (!thumbnail.dataset[key]) {
      thumbnail.dataset[key] = (-4 + Math.random() * 8).toFixed(2);
    }

    return Number(thumbnail.dataset[key]);
  }

  function getImageIndexes(thumbnail, overlayCount) {
    if (!taffyImageUrls.length) {
      return [0];
    }

    if (thumbnail.dataset.taffyAssetVersion !== taffyAssetVersion) {
      thumbnail.dataset.taffyAssetVersion = taffyAssetVersion;
      delete thumbnail.dataset.taffyImageIndexes;
    }

    const storedIndexes = (thumbnail.dataset.taffyImageIndexes || "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value < taffyImageUrls.length);

    const needsNewIndexes =
      storedIndexes.length < overlayCount ||
      new Set(storedIndexes.slice(0, overlayCount)).size < overlayCount;

    if (!needsNewIndexes) {
      return storedIndexes.slice(0, overlayCount);
    }

    const imageIndexes = [];

    for (let slot = 0; slot < overlayCount; slot += 1) {
      const nextIndex = drawImageIndex(imageIndexes);

      if (nextIndex === null) {
        break;
      }

      imageIndexes.push(nextIndex);
    }

    thumbnail.dataset.taffyImageIndexes = imageIndexes.join(",");
    return imageIndexes;
  }

  function drawImageIndex(excludedIndexes = []) {
    if (!taffyImageUrls.length) {
      return null;
    }

    if (taffyImageUrls.length === 1) {
      return 0;
    }

    const excluded = new Set(excludedIndexes);

    while (imageIndexBag.length) {
      const nextIndex = imageIndexBag.shift();

      if (!excluded.has(nextIndex)) {
        return nextIndex;
      }
    }

    imageIndexBag = shuffledImageIndexes().filter((index) => !excluded.has(index));

    if (!imageIndexBag.length) {
      return null;
    }

    return imageIndexBag.shift();
  }

  function shuffledImageIndexes() {
    const indexes = taffyImageUrls.map((_, index) => index);

    for (let index = indexes.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
    }

    return indexes;
  }

  function getRandomImageUrl(thumbnail, slot = 0, overlayCount = 1) {
    const imageIndexes = getImageIndexes(thumbnail, overlayCount);
    const imageIndex = imageIndexes[slot] ?? imageIndexes[0];
    return taffyImageUrls[imageIndex] || FALLBACK_TAFFY_IMAGE_URL;
  }

  function resolveSide(thumbnail) {
    if (settings.position === "bottom-left") {
      return "left";
    }

    if (settings.position === "bottom-right") {
      return "right";
    }

    return getRandomSide(thumbnail);
  }

  function getOverlayWidth(thumbnail, slot = 0, overlayCount = 1) {
    const isShortsThumbnail = isYoutubeShortsThumbnail(thumbnail);
    const width = settings.size * getRandomScale(thumbnail, slot) * (isShortsThumbnail ? 2.15 : 1);
    const maxWidth = isShortsThumbnail ? (overlayCount > 1 ? 58 : 78) : 36;
    const cappedWidth = overlayCount > 1 || isShortsThumbnail ? Math.min(width, maxWidth) : width;
    return Math.round(cappedWidth * 10) / 10;
  }

  function createOverlay(slot) {
    const overlay = document.createElement("img");
    overlay.className = "taffy-overlay";
    overlay.alt = "";
    overlay.decoding = "async";
    overlay.loading = "lazy";
    overlay.dataset.taffyOverlay = "true";
    overlay.dataset.taffySlot = String(slot);
    return overlay;
  }

  function createOverlayLayer() {
    const layer = document.createElement("div");
    layer.className = "taffy-overlay-layer";
    layer.dataset.taffyOverlayLayer = "true";
    return layer;
  }

  function normalizeThumbnailElement(element) {
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    const legacyThumbnail = element.matches("ytd-thumbnail")
      ? element
      : element.closest("ytd-thumbnail");

    if (legacyThumbnail) {
      return legacyThumbnail;
    }

    const modernThumbnail = element.matches("yt-thumbnail-view-model")
      ? element
      : element.querySelector("yt-thumbnail-view-model") || element.closest("yt-thumbnail-view-model");

    if (modernThumbnail) {
      return modernThumbnail;
    }

    const bilibiliThumbnail = findOutermostThumbnailHost(
      element,
      BILIBILI_THUMBNAIL_HOST_SELECTOR,
      BILIBILI_THUMBNAIL_SELECTOR
    );

    if (bilibiliThumbnail) {
      return bilibiliThumbnail;
    }

    return element;
  }

  function findOutermostThumbnailHost(element, hostSelector, fallbackSelector) {
    let host =
      (element.matches(hostSelector) && element) ||
      element.closest(hostSelector) ||
      element.querySelector(hostSelector) ||
      (element.matches(fallbackSelector) && element) ||
      element.closest(fallbackSelector) ||
      element.querySelector(fallbackSelector);

    if (!host) {
      return null;
    }

    let parent = host.parentElement;

    while (parent && parent !== document.body) {
      if (parent.matches(hostSelector)) {
        host = parent;
      }

      parent = parent.parentElement;
    }

    return host;
  }

  function isImageOnlyElement(element) {
    return ["IMG", "PICTURE", "SOURCE"].includes(element.tagName);
  }

  function isYoutubeShortsThumbnail(thumbnail) {
    if (!location.hostname.includes("youtube.com")) {
      return false;
    }

    if (
      thumbnail.closest(YOUTUBE_SHORTS_CONTAINER_SELECTOR) ||
      thumbnail.querySelector("a[href*='/shorts/']") ||
      thumbnail.closest("a[href*='/shorts/']")
    ) {
      return true;
    }

    const { width, height } = thumbnail.getBoundingClientRect();
    return width > 0 && height > 0 && height / width > 1.25;
  }

  function canUseTwoOverlays(thumbnail) {
    if (taffyImageUrls.length < 2) {
      return false;
    }

    const thumbnailWidth = thumbnail.getBoundingClientRect().width || thumbnail.clientWidth;
    return !thumbnailWidth || thumbnailWidth >= 220;
  }

  function getOverlayCount(thumbnail) {
    if (isYoutubeShortsThumbnail(thumbnail)) {
      thumbnail.dataset.taffyOverlayCount = "1";
      return 1;
    }

    if (!canUseTwoOverlays(thumbnail)) {
      thumbnail.dataset.taffyOverlayCount = "1";
      return 1;
    }

    if (!thumbnail.dataset.taffyOverlayCount) {
      thumbnail.dataset.taffyOverlayCount = Math.random() < 0.38 ? "2" : "1";
    }

    return thumbnail.dataset.taffyOverlayCount === "2" ? 2 : 1;
  }

  function getOverlaySide(thumbnail, slot, overlayCount) {
    if (overlayCount < 2) {
      return resolveSide(thumbnail);
    }

    const primarySide = resolveSide(thumbnail);

    if (slot === 0) {
      return primarySide;
    }

    return primarySide === "left" ? "right" : "left";
  }

  function getOverlayLayer(thumbnail) {
    if (isImageOnlyElement(thumbnail) && thumbnail.parentElement) {
      thumbnail = thumbnail.parentElement;
    }

    let layer = thumbnail.querySelector(":scope > .taffy-overlay-layer");

    if (!layer) {
      layer = createOverlayLayer();
      thumbnail.appendChild(layer);
    }

    return layer;
  }

  function updateOverlay(thumbnail, overlay, slot, overlayCount) {
    const side = getOverlaySide(thumbnail, slot, overlayCount);
    const imageUrl = getRandomImageUrl(thumbnail, slot, overlayCount);
    const widthValue = `${getOverlayWidth(thumbnail, slot, overlayCount)}%`;
    const rotationValue = `${getRandomRotation(thumbnail, slot)}deg`;

    thumbnail.classList.add("taffy-thumbnail-target");
    overlay.dataset.taffySlot = String(slot);
    if (overlay.src !== imageUrl) {
      overlay.src = imageUrl;
    }

    if (overlay.style.getPropertyValue("--taffy-width") !== widthValue) {
      overlay.style.setProperty("--taffy-width", widthValue);
    }

    if (overlay.style.getPropertyValue("--taffy-rotation") !== rotationValue) {
      overlay.style.setProperty("--taffy-rotation", rotationValue);
    }

    overlay.classList.toggle("taffy-overlay--left", side === "left");
    overlay.classList.toggle("taffy-overlay--right", side === "right");
    overlay.classList.toggle("taffy-overlay--pair", overlayCount > 1);
    overlay.classList.toggle("taffy-overlay--hidden", !settings.enabled);
  }

  function processThumbnail(thumbnail) {
    thumbnail = normalizeThumbnailElement(thumbnail);

    if (!(thumbnail instanceof HTMLElement)) {
      return;
    }

    if (isImageOnlyElement(thumbnail) && thumbnail.parentElement) {
      thumbnail = thumbnail.parentElement;
    }

    thumbnail.dataset.taffyProcessed = "true";

    const overlayLayer = getOverlayLayer(thumbnail);
    const overlayCount = getOverlayCount(thumbnail);
    const activeOverlays = new Set();

    // Video sites frequently rebuild thumbnail internals. Keep one overlay layer in
    // our own layer so hover previews and route changes do not create duplicates.
    thumbnail.querySelectorAll(".taffy-overlay-layer").forEach((existingLayer) => {
      if (existingLayer !== overlayLayer) {
        existingLayer.remove();
      }
    });

    for (let slot = 0; slot < overlayCount; slot += 1) {
      let overlay = overlayLayer.querySelector(`:scope > .taffy-overlay[data-taffy-slot="${slot}"]`);

      if (!overlay) {
        overlay = createOverlay(slot);
        overlayLayer.appendChild(overlay);
      }

      activeOverlays.add(overlay);
      updateOverlay(thumbnail, overlay, slot, overlayCount);
    }

    overlayLayer.querySelectorAll(":scope > .taffy-overlay").forEach((existingOverlay) => {
      if (!activeOverlays.has(existingOverlay)) {
        existingOverlay.remove();
      }
    });
  }

  function processThumbnails(root = document) {
    const thumbnails = new Set();
    const addThumbnail = (element) => {
      const thumbnail = normalizeThumbnailElement(element);

      if (thumbnail) {
        thumbnails.add(thumbnail);
      }
    };

    if (root instanceof HTMLElement && root.matches(THUMBNAIL_SELECTOR)) {
      addThumbnail(root);
    }

    if (root.querySelectorAll) {
      root.querySelectorAll(THUMBNAIL_SELECTOR).forEach(addThumbnail);
    }

    thumbnails.forEach(processThumbnail);
  }

  function scheduleProcessThumbnails(root = document) {
    window.clearTimeout(debounceId);
    debounceId = window.setTimeout(() => processThumbnails(root), 120);
  }

  function isThumbnailRelatedNode(node) {
    if (!(node instanceof HTMLElement)) {
      return false;
    }

    return Boolean(
      node.matches(THUMBNAIL_SELECTOR) ||
        node.closest(DIRECT_THUMBNAIL_HOST_SELECTOR) ||
        node.querySelector?.(THUMBNAIL_SELECTOR)
    );
  }

  function readSettings() {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (storedSettings) => {
      settings = normalizeSettings(storedSettings);
      scheduleProcessThumbnails();
    });
  }

  async function loadTaffyAssets() {
    try {
      const response = await fetch(chrome.runtime.getURL("images/assets.json"), {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Could not load assets.json: ${response.status}`);
      }

      const assetManifest = await response.json();
      const imageFiles = Array.isArray(assetManifest.images) ? assetManifest.images : [];
      const pngFiles = imageFiles.filter((file) => typeof file === "string" && file.endsWith(".png"));

      if (pngFiles.length) {
        taffyImageUrls = pngFiles.map((file) => chrome.runtime.getURL(file));
        taffyAssetVersion = pngFiles.join("|");
        imageIndexBag = shuffledImageIndexes();
      }
    } catch (error) {
      console.warn("[Taffy Overlay] Falling back to images/taffy.png.", error);
    }
  }

  function watchForNewThumbnails() {
    const observer = new MutationObserver((mutations) => {
      const shouldProcess = mutations.some((mutation) => {
        if (
          mutation.target instanceof HTMLElement &&
          mutation.target.closest(".taffy-overlay-layer")
        ) {
          return false;
        }

        if (
          isThumbnailRelatedNode(mutation.target) ||
          Array.from(mutation.addedNodes).some(isThumbnailRelatedNode) ||
          Array.from(mutation.removedNodes).some(isThumbnailRelatedNode)
        ) {
          return true;
        }

        return false;
      });

      if (shouldProcess) {
        scheduleProcessThumbnails();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "src", "hidden", "style", "class"]
    });
  }

  function startSteadyScan() {
    window.clearInterval(steadyScanId);
    steadyScanId = window.setInterval(() => processThumbnails(), 1000);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    settings = normalizeSettings({
      enabled: changes.enabled ? changes.enabled.newValue : settings.enabled,
      size: changes.size ? changes.size.newValue : settings.size,
      position: changes.position ? changes.position.newValue : settings.position
    });

    scheduleProcessThumbnails();
  });

  async function start() {
    await loadTaffyAssets();
    readSettings();
    watchForNewThumbnails();
    startSteadyScan();
    scheduleProcessThumbnails();
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
