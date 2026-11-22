/* ============================================================
   mac-scrollbar —— 自绘悬浮滚动条（S6'）
   ============================================================
   模板 chrome.css 的 .mac-scrollbar（scrollbar.tsx）经 PortPilot 的
   vanilla 实现移植为 ES Module：原生滚动条会在容器圆角处切出一道
   灰白轨道，这里换成透明轨道 + 胶囊滑块，上下各避让 20px 圆角弧
   （样式见 src/vendor/solid-glass.css 的 .panel .mac-scrollbar）。

   API：attachMacScrollbar(scroller) → { detach, sync }
        attach 幂等：重复挂同一个容器返回已有实例。
   ============================================================ */

const instances = new WeakMap();

function create(host, scroller) {
  const track = document.createElement('div');
  track.className = 'mac-scrollbar';
  track.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('div');
  thumb.className = 'mac-scrollbar__thumb';
  track.appendChild(thumb);
  host.appendChild(track);

  let raf = 0;
  let drag = null; // { startY, startScroll }
  let on = false;

  function visible(next) {
    if (on === next) return;
    on = next;
    track.classList.toggle('is-on', on);
  }

  // 与模板一致：rAF 合帧同步滑块高度与位移。
  function sync() {
    const view = scroller.clientHeight;
    const total = scroller.scrollHeight;
    if (total <= view + 1) {
      visible(false);
      return;
    }
    visible(true);

    const trackH = track.clientHeight;
    if (trackH <= 0) return;

    const thumbH = Math.max(32, Math.round((trackH * view) / total));
    const maxScroll = Math.max(1, total - view);
    const offset = (scroller.scrollTop / maxScroll) * Math.max(0, trackH - thumbH);

    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${offset}px)`;
  }

  function scheduleSync() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = window.requestAnimationFrame(sync);
  }

  /* ------------------------- 拖拽（1:1） ------------------------- */
  thumb.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    try {
      thumb.setPointerCapture(event.pointerId);
    } catch {
      // setPointerCapture 在个别指针类型上不可用；拖拽降级为不捕获。
    }
    drag = { startY: event.clientY, startScroll: scroller.scrollTop };
    track.classList.add('is-dragging');
  });

  thumb.addEventListener('pointermove', event => {
    if (!drag) return;
    const span = Math.max(1, track.clientHeight - thumb.offsetHeight);
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollTop = drag.startScroll + (event.clientY - drag.startY) * (maxScroll / span);
  });

  function endDrag(event) {
    if (!drag) return;
    drag = null;
    track.classList.remove('is-dragging');
    if (event && event.pointerId !== undefined) {
      try {
        if (thumb.hasPointerCapture(event.pointerId)) thumb.releasePointerCapture(event.pointerId);
      } catch {
        // 捕获本就未建立时忽略。
      }
    }
  }
  thumb.addEventListener('pointerup', endDrag);
  thumb.addEventListener('pointercancel', endDrag);

  /* --------------------- 轨道点击跳转 --------------------- */
  track.addEventListener('click', event => {
    if (event.target === thumb || drag) return;
    const rect = track.getBoundingClientRect();
    const clickY = event.clientY - rect.top;
    const thumbH = thumb.offsetHeight;
    const span = Math.max(1, track.clientHeight - thumbH);
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const ratio = Math.max(0, Math.min(1, (clickY - thumbH / 2) / span));
    scroller.scrollTo({ top: ratio * maxScroll, behavior: 'smooth' });
  });

  /* ------------------------- 监听 ------------------------- */
  scroller.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', scheduleSync);

  const ro = new ResizeObserver(scheduleSync);
  ro.observe(scroller);
  const inner = scroller.firstElementChild;
  if (inner) ro.observe(inner);

  let mo = null;
  if (inner) {
    mo = new MutationObserver(scheduleSync);
    mo.observe(inner, { childList: true, subtree: true });
  }

  scheduleSync();
  const settleTimer = window.setTimeout(sync, 250);

  return {
    detach() {
      if (raf) window.cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
      scroller.removeEventListener('scroll', sync);
      window.removeEventListener('resize', scheduleSync);
      ro.disconnect();
      if (mo) mo.disconnect();
      if (track.parentNode) track.parentNode.removeChild(track);
    },
    sync
  };
}

/** 挂到一个滚动容器（面板里是 .panel__scroll）；返回 { detach, sync }。 */
export function attachMacScrollbar(scroller) {
  if (!scroller || !scroller.nodeType) return null;
  if (instances.has(scroller)) return instances.get(scroller);
  const instance = create(scroller.parentElement || document.body, scroller);
  instances.set(scroller, instance);
  return instance;
}
