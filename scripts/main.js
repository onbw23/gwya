const statusNode = document.querySelector("[data-status]");
const pageTitle = document.querySelector('meta[property="og:title"]')?.content || document.title;
const ogUrl = document.querySelector('meta[property="og:url"]')?.content;
const pageUrl = ogUrl && !ogUrl.includes("example.com") ? ogUrl : window.location.href;
const pageImage =
  document.querySelector('meta[property="og:image"]')?.content ||
  new URL("assets/hero/hero-1440.webp", pageUrl).href;
const kakaoJavaScriptKey = "2badc8486cc2d27cbd00441e45a17460";
const weddingDate = new Date("2026-10-24T15:30:00+09:00").getTime();
const venue = {
  name: "JK아트컨벤션 그랜드홀",
  lat: 37.51762507399807,
  lng: 126.89978187551785,
};
let toastTimer = 0;
let lightboxIndex = 0;
let lightboxScale = 1;
let lightboxOffset = { x: 0, y: 0 };
let lightboxDrag = null;
let lightboxPinch = null;
let lightboxSwipe = null;
let lightboxScrollY = 0;
const preloadedImages = new Set();

function preloadImage(src) {
  if (!src || preloadedImages.has(src)) {
    return;
  }

  preloadedImages.add(src);
  const image = new Image();
  image.decoding = "async";
  image.src = src;
}

document.addEventListener("dragstart", (event) => {
  if (event.target.closest("button, a, .lightbox, .splash")) {
    event.preventDefault();
  }
});

/* Splash */
function initSplash() {
  const splash = document.querySelector("[data-splash]");
  const splashScrollY = window.scrollY;

  if (!splash) {
    document.body.classList.remove("is-splashing");
    return;
  }

  document.body.style.top = `-${splashScrollY}px`;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const splashDuration = reduceMotion ? 400 : 3600;

  window.setTimeout(() => {
    splash.classList.add("is-hidden");
    document.body.classList.remove("is-splashing");
    document.body.style.top = "";
    window.scrollTo(0, splashScrollY);
  }, splashDuration);

  splash.addEventListener(
    "transitionend",
    () => {
      splash.remove();
    },
    { once: true },
  );
}

initSplash();

/* Scroll reveals */
function initReveals() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealGroups = [
    [".section", 0],
    [".details .event-summary > *", 90],
    [".details .calendar-head", 150],
    [".details .calendar-weekdays", 210],
    [".details .calendar-days", 270],
    [".details .countdown", 330],
    [".location .map-preview", 120],
    [".gallery .gallery-track", 120],
    [".accounts .account-group", 120],
    [".share .button-row", 120],
  ];
  const revealItems = [];

  revealGroups.forEach(([selector, baseDelay]) => {
    document.querySelectorAll(selector).forEach((element, index) => {
      element.dataset.reveal = "";
      element.style.setProperty("--reveal-delay", `${baseDelay + index * 70}ms`);
      revealItems.push(element);
    });
  });

  if (revealItems.length === 0) {
    return;
  }

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((element) => element.classList.add("is-visible"));
    if (!reduceMotion) {
      document.querySelectorAll("[data-gallery] .swipe-hint").forEach((hint) => {
        hint.classList.add("is-active");
      });
    }
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        if (entry.target.matches(".gallery-track")) {
          entry.target.closest("[data-gallery]")?.querySelector(".swipe-hint")?.classList.add("is-active");
        }
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.12,
    },
  );

  revealItems.forEach((element) => observer.observe(element));
}

initReveals();

/* Naver map */
function initNaverMap() {
  const mapNode = document.querySelector("[data-naver-map]");

  if (!mapNode) {
    return;
  }

  if (!window.naver?.maps) {
    const placeholder = mapNode.querySelector(".map-placeholder");
    if (placeholder) {
      placeholder.textContent = "지도를 불러오지 못했습니다.";
    }
    return;
  }

  const venuePosition = new naver.maps.LatLng(venue.lat, venue.lng);
  const map = new naver.maps.Map(mapNode, {
    center: venuePosition,
    zoom: 17,
    minZoom: 13,
    scaleControl: false,
    mapDataControl: false,
    logoControl: true,
    zoomControl: true,
    zoomControlOptions: {
      position: naver.maps.Position.TOP_RIGHT,
    },
  });

  new naver.maps.Marker({
    position: venuePosition,
    map,
    title: venue.name,
  });

  mapNode.classList.add("is-loaded");
}

/* Toast and status */
function getToastNode() {
  let toastNode = document.querySelector("[data-toast]");

  if (!toastNode) {
    toastNode = document.createElement("div");
    toastNode.className = "toast";
    toastNode.dataset.toast = "";
    toastNode.setAttribute("role", "status");
    toastNode.setAttribute("aria-live", "polite");
    document.body.appendChild(toastNode);
  }

  return toastNode;
}

function syncVisualViewport() {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0;
  const top = viewport?.offsetTop || 0;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;
  const scale = viewport?.scale || 1;

  document.documentElement.style.setProperty("--vv-left", `${left}px`);
  document.documentElement.style.setProperty("--vv-top", `${top}px`);
  document.documentElement.style.setProperty("--vv-width", `${width}px`);
  document.documentElement.style.setProperty("--vv-height", `${height}px`);
  document.documentElement.style.setProperty("--vv-scale", scale);
  document.documentElement.classList.toggle("is-viewport-zoomed", scale > 1.01);
}

function positionToast(toastNode) {
  const viewport = window.visualViewport;

  if (!viewport) {
    toastNode.style.left = "";
    toastNode.style.top = "";
    toastNode.style.bottom = "";
    toastNode.style.maxWidth = "";
    return;
  }

  toastNode.style.left = `${viewport.offsetLeft + viewport.width / 2}px`;
  toastNode.style.top = `${viewport.offsetTop + viewport.height - 64}px`;
  toastNode.style.bottom = "auto";
  toastNode.style.maxWidth = `${Math.min(window.innerWidth - 44, 360)}px`;
}

function showToast(message) {
  const toastNode = getToastNode();

  window.clearTimeout(toastTimer);
  syncVisualViewport();
  positionToast(toastNode);
  toastNode.textContent = message;
  toastNode.classList.add("is-visible");

  toastTimer = window.setTimeout(() => {
    toastNode.classList.remove("is-visible");
  }, 1800);
}

function setStatus(message) {
  if (statusNode) {
    statusNode.textContent = message;
  }

  showToast(message);
}

window.visualViewport?.addEventListener("resize", () => {
  syncVisualViewport();
  const toastNode = document.querySelector("[data-toast].is-visible");
  if (toastNode) {
    positionToast(toastNode);
  }
});

window.visualViewport?.addEventListener("scroll", () => {
  syncVisualViewport();
  const toastNode = document.querySelector("[data-toast].is-visible");
  if (toastNode) {
    positionToast(toastNode);
  }
});

syncVisualViewport();

initNaverMap();

/* Clipboard */
function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand("copy");
  textarea.remove();
  return success;
}

async function copyText(text, successMessage) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else if (!fallbackCopy(text)) {
      throw new Error("copy failed");
    }
    setStatus(successMessage);
  } catch {
    setStatus("복사하지 못했습니다.");
  }
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", () => {
    copyText(button.dataset.copy, button.dataset.copyMessage || "계좌번호를 복사했습니다.");
  });
});

document.querySelectorAll("[data-copy-link]").forEach((button) => {
  button.addEventListener("click", () => {
    copyText(pageUrl, "초대장 링크를 복사했습니다.");
  });
});

function initKakaoShare() {
  if (!window.Kakao) {
    return false;
  }

  if (!Kakao.isInitialized()) {
    Kakao.init(kakaoJavaScriptKey);
  }

  return Kakao.isInitialized() && Boolean(Kakao.Share);
}

document.querySelectorAll("[data-share]").forEach((button) => {
  button.addEventListener("click", () => {
    if (initKakaoShare()) {
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: pageTitle,
          description: "2026년 10월 24일 토요일 오후 3시 30분 · JK아트컨벤션 그랜드홀",
          imageUrl: pageImage,
          link: {
            mobileWebUrl: pageUrl,
            webUrl: pageUrl,
          },
        },
        buttons: [
          {
            title: "초대장 보기",
            link: {
              mobileWebUrl: pageUrl,
              webUrl: pageUrl,
            },
          },
        ],
      });
      return;
    }

    copyText(pageUrl, "초대장 링크를 복사했습니다.");
  });
});

/* Account accordions */
document.querySelectorAll(".account-group").forEach((group) => {
  const summary = group.querySelector("summary");
  const content = group.querySelector(".account-list");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!summary || !content) {
    return;
  }

  content.style.height = group.open ? "auto" : "0px";
  content.style.opacity = group.open ? "1" : "0";
  content.style.transition = reduceMotion ? "none" : "height 260ms ease, opacity 180ms ease";
  group.classList.toggle("is-expanded", group.open);

  summary.addEventListener("click", (event) => {
    event.preventDefault();

    if (reduceMotion) {
      group.open = !group.open;
      content.style.height = group.open ? "auto" : "0px";
      content.style.opacity = group.open ? "1" : "0";
      group.classList.toggle("is-expanded", group.open);
      return;
    }

    if (group.dataset.animating === "true") {
      return;
    }

    group.dataset.animating = "true";

    if (!group.open) {
      group.open = true;
      group.classList.add("is-expanded");
      content.style.height = "0px";
      content.style.opacity = "0";

      requestAnimationFrame(() => {
        content.style.height = `${content.scrollHeight}px`;
        content.style.opacity = "1";
      });
    } else {
      group.classList.remove("is-expanded");
      content.style.height = `${content.scrollHeight}px`;
      content.style.opacity = "1";

      requestAnimationFrame(() => {
        content.style.height = "0px";
        content.style.opacity = "0";
      });
    }

    const finish = (transitionEvent) => {
      if (transitionEvent.propertyName !== "height") {
        return;
      }

      content.removeEventListener("transitionend", finish);

      if (group.open && content.style.height !== "0px") {
        content.style.height = "auto";
      } else {
        group.open = false;
      }

      group.dataset.animating = "false";
    };

    content.addEventListener("transitionend", finish);
  });
});

/* Countdown */
document.querySelectorAll("[data-countdown]").forEach((countdown) => {
  const daysNode = countdown.querySelector("[data-countdown-days]");
  const hoursNode = countdown.querySelector("[data-countdown-hours]");
  const minutesNode = countdown.querySelector("[data-countdown-minutes]");
  const secondsNode = countdown.querySelector("[data-countdown-seconds]");

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function updateCountdown() {
    const diff = Math.max(0, weddingDate - Date.now());
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (daysNode) daysNode.textContent = String(days);
    if (hoursNode) hoursNode.textContent = pad(hours);
    if (minutesNode) minutesNode.textContent = pad(minutes);
    if (secondsNode) secondsNode.textContent = pad(seconds);
  }

  updateCountdown();
  window.setInterval(updateCountdown, 1000);
});

/* Gallery */
const lightbox = document.querySelector("[data-lightbox]");
const lightboxImage = document.querySelector("[data-lightbox-image]");
const lightboxStage = document.querySelector("[data-lightbox-stage]");
const lightboxCurrent = document.querySelector("[data-lightbox-current]");
const lightboxTotal = document.querySelector("[data-lightbox-total]");
let lightboxItems = [];

function updateLightboxTransform() {
  if (!lightboxImage) {
    return;
  }

  lightboxImage.style.setProperty("--lightbox-scale", lightboxScale);
  lightboxImage.style.setProperty("--lightbox-x", `${lightboxOffset.x}px`);
  lightboxImage.style.setProperty("--lightbox-y", `${lightboxOffset.y}px`);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampLightboxOffset(offset = lightboxOffset) {
  if (!lightboxImage || !lightboxStage || lightboxScale <= 1) {
    return { x: 0, y: 0 };
  }

  const stageRect = lightboxStage.getBoundingClientRect();
  const maxX = Math.max(0, (lightboxImage.offsetWidth * lightboxScale - stageRect.width) / 2);
  const maxY = Math.max(0, (lightboxImage.offsetHeight * lightboxScale - stageRect.height) / 2);

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

function resetLightboxZoom() {
  lightboxScale = 1;
  lightboxOffset = { x: 0, y: 0 };
  updateLightboxTransform();
}

function renderLightbox() {
  const item = lightboxItems[lightboxIndex];

  if (!item || !lightboxImage) {
    return;
  }

  lightboxImage.src = item.src;
  lightboxImage.alt = item.alt;

  if (lightboxCurrent) {
    lightboxCurrent.textContent = String(lightboxIndex + 1);
  }

  if (lightboxTotal) {
    lightboxTotal.textContent = String(lightboxItems.length);
  }

  resetLightboxZoom();
  preloadLightboxNeighbors();
}

function preloadLightboxNeighbors() {
  if (lightboxItems.length < 2) {
    return;
  }

  [-1, 1].forEach((offset) => {
    const item = lightboxItems[(lightboxIndex + offset + lightboxItems.length) % lightboxItems.length];
    preloadImage(item?.src);
  });
}

function openLightbox(index) {
  if (!lightbox || lightboxItems.length === 0) {
    return;
  }

  syncVisualViewport();

  if (window.visualViewport && window.visualViewport.scale > 1.01) {
    setStatus("화면 확대를 해제한 뒤 사진을 열어주세요.");
    return;
  }

  lightboxIndex = index;
  renderLightbox();
  lightboxScrollY = window.scrollY;
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.position = "fixed";
  document.body.style.top = `-${lightboxScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  if (!lightbox) {
    return;
  }

  const previousScrollBehavior = document.documentElement.style.scrollBehavior;

  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.overflow = "";
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, lightboxScrollY);
  requestAnimationFrame(() => {
    document.documentElement.style.scrollBehavior = previousScrollBehavior;
  });
  resetLightboxZoom();
}

function moveLightbox(direction) {
  if (lightboxItems.length === 0) {
    return;
  }

  lightboxIndex = (lightboxIndex + direction + lightboxItems.length) % lightboxItems.length;
  renderLightbox();
}

function setLightboxScale(nextScale) {
  lightboxScale = Math.min(3, Math.max(1, nextScale));
  lightboxOffset = clampLightboxOffset();

  if (lightboxScale === 1) {
    lightboxOffset = { x: 0, y: 0 };
  }

  updateLightboxTransform();
}

document.querySelectorAll("[data-gallery]").forEach((gallery) => {
  const track = gallery.querySelector("[data-gallery-track]");
  const slides = Array.from(gallery.querySelectorAll(".gallery-slide"));
  const images = Array.from(gallery.querySelectorAll(".gallery-slide img"));
  const current = gallery.querySelector("[data-gallery-current]");
  const total = gallery.querySelector("[data-gallery-total]");
  const prev = gallery.querySelector("[data-gallery-prev]");
  const next = gallery.querySelector("[data-gallery-next]");
  const openCurrent = gallery.querySelector("[data-gallery-open]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!track || slides.length === 0) {
    return;
  }

  if (total) {
    total.textContent = String(slides.length);
  }

  const lightboxStartIndex = lightboxItems.length;

  images.forEach((image, index) => {
    lightboxItems.push({
      src: image.dataset.full || image.currentSrc || image.src,
      alt: image.alt || `웨딩 사진 ${index + 1}`,
    });

    image.addEventListener("click", () => openLightbox(lightboxStartIndex + index));
  });

  function getStep() {
    const firstSlide = slides[0];
    const styles = window.getComputedStyle(track);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0");
    return firstSlide.getBoundingClientRect().width + gap;
  }

  function getCurrentIndex() {
    return Math.min(slides.length - 1, Math.max(0, Math.round(track.scrollLeft / getStep())));
  }

  function updateCounter() {
    const currentIndex = getCurrentIndex();

    if (current) {
      current.textContent = String(currentIndex + 1);
    }

    preloadGalleryNeighbors(currentIndex);
  }

  function preloadGalleryNeighbors(index) {
    [index, index + 1, index + 2].forEach((nextIndex) => {
      const image = images[nextIndex];
      preloadImage(image?.currentSrc || image?.src);
    });
  }

  function move(direction) {
    track.scrollBy({
      left: direction * getStep(),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  prev?.addEventListener("click", () => move(-1));
  next?.addEventListener("click", () => move(1));
  openCurrent?.addEventListener("click", () => openLightbox(lightboxStartIndex + getCurrentIndex()));

  let frame = 0;
  track.addEventListener("scroll", () => {
    if (frame) {
      cancelAnimationFrame(frame);
    }

    frame = requestAnimationFrame(() => {
      updateCounter();
      frame = 0;
    });
  });

  updateCounter();
});

document.querySelectorAll("[data-lightbox-close]").forEach((button) => {
  button.addEventListener("click", closeLightbox);
});

document.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => moveLightbox(-1));
document.querySelector("[data-lightbox-next]")?.addEventListener("click", () => moveLightbox(1));

function getTouchDistance(touches) {
  const [first, second] = touches;
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

lightboxStage?.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length === 1 && lightboxScale === 1) {
      const [touch] = event.touches;

      lightboxSwipe = {
        startX: touch.clientX,
        startY: touch.clientY,
      };
      return;
    }

    if (event.touches.length === 1 && lightboxScale > 1) {
      const [touch] = event.touches;

      event.preventDefault();
      lightboxPinch = null;
      lightboxDrag = {
        startX: touch.clientX,
        startY: touch.clientY,
        originX: lightboxOffset.x,
        originY: lightboxOffset.y,
      };
      lightboxStage.classList.add("is-dragging");
      return;
    }

    if (event.touches.length !== 2) {
      return;
    }

    event.preventDefault();
    lightboxDrag = null;
    lightboxSwipe = null;
    lightboxStage.classList.remove("is-dragging");
    lightboxStage.classList.add("is-gesturing");
    lightboxPinch = {
      distance: getTouchDistance(event.touches),
      scale: lightboxScale,
    };
  },
  { passive: false },
);

lightboxStage?.addEventListener(
  "touchmove",
  (event) => {
    if (lightboxSwipe && event.touches.length === 1) {
      const [touch] = event.touches;
      const deltaX = touch.clientX - lightboxSwipe.startX;
      const deltaY = touch.clientY - lightboxSwipe.startY;

      if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
        event.preventDefault();
      }

      return;
    }

    if (lightboxDrag && event.touches.length === 1) {
      const [touch] = event.touches;

      event.preventDefault();
      lightboxOffset = clampLightboxOffset({
        x: lightboxDrag.originX + touch.clientX - lightboxDrag.startX,
        y: lightboxDrag.originY + touch.clientY - lightboxDrag.startY,
      });
      updateLightboxTransform();
      return;
    }

    if (!lightboxPinch || event.touches.length !== 2) {
      return;
    }

    event.preventDefault();
    setLightboxScale(lightboxPinch.scale * (getTouchDistance(event.touches) / lightboxPinch.distance));
  },
  { passive: false },
);

lightboxStage?.addEventListener("touchend", (event) => {
  if (lightboxSwipe && event.changedTouches.length > 0) {
    const [touch] = event.changedTouches;
    const deltaX = touch.clientX - lightboxSwipe.startX;
    const deltaY = touch.clientY - lightboxSwipe.startY;

    if (Math.abs(deltaX) > 54 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      moveLightbox(deltaX < 0 ? 1 : -1);
    }
  }

  lightboxDrag = null;
  lightboxPinch = null;
  lightboxSwipe = null;
  lightboxOffset = clampLightboxOffset();
  updateLightboxTransform();
  lightboxStage?.classList.remove("is-dragging");
  lightboxStage?.classList.remove("is-gesturing");
});

lightboxStage?.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "mouse") {
    return;
  }

  if (lightboxScale <= 1) {
    return;
  }

  lightboxDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: lightboxOffset.x,
    originY: lightboxOffset.y,
  };
  lightboxStage.setPointerCapture(event.pointerId);
  lightboxStage.classList.add("is-dragging");
});

lightboxStage?.addEventListener("pointermove", (event) => {
  if (!lightboxDrag || event.pointerId !== lightboxDrag.pointerId) {
    return;
  }

  lightboxOffset = {
    x: lightboxDrag.originX + event.clientX - lightboxDrag.startX,
    y: lightboxDrag.originY + event.clientY - lightboxDrag.startY,
  };
  lightboxOffset = clampLightboxOffset(lightboxOffset);
  updateLightboxTransform();
});

function stopLightboxDrag(event) {
  if (!lightboxDrag || event.pointerId !== lightboxDrag.pointerId) {
    return;
  }

  lightboxDrag = null;
  lightboxStage?.classList.remove("is-dragging");
}

lightboxStage?.addEventListener("pointerup", stopLightboxDrag);
lightboxStage?.addEventListener("pointercancel", stopLightboxDrag);

document.addEventListener("keydown", (event) => {
  if (!lightbox?.classList.contains("is-open")) {
    return;
  }

  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowLeft") moveLightbox(-1);
  if (event.key === "ArrowRight") moveLightbox(1);
});
