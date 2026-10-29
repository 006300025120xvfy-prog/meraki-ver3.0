/**
 * 全ページ共通の効果音（ページ遷移用）
 * localStorage: drawRunSeEnabled, drawRunSeVolume (0-100)
 * ゲーム内ボタン音は game.js 側のみ（二重再生しない）
 */
(function (global) {
  var SEARCH = ["sound/", "", "assets/", "assets/sound/", "audio/"];
  var buttonAudio = null;
  var lastPlay = 0;
  var COOLDOWN_MS = 150;
  var BUTTON_BASE = 0.12;
  var BUTTON_MAX = 0.22;

  function getSaved(key) {
    try {
      var v = localStorage.getItem(key);
      if (v !== null && v !== undefined) return v;
    } catch (e) {}
    try {
      var v2 = sessionStorage.getItem(key);
      if (v2 !== null && v2 !== undefined) return v2;
    } catch (e) {}
    return null;
  }

  function save(key, value) {
    var s = String(value);
    try { localStorage.setItem(key, s); } catch (e) {}
    try { sessionStorage.setItem(key, s); } catch (e) {}
  }

  if (getSaved("drawRunSeEnabled") === null) save("drawRunSeEnabled", "true");
  if (getSaved("drawRunSeVolume") === null) save("drawRunSeVolume", "28");

  function isEnabled() {
    return getSaved("drawRunSeEnabled") !== "false";
  }

  function masterVol() {
    var n = Number(getSaved("drawRunSeVolume"));
    if (!Number.isFinite(n)) n = 28;
    if (n > 0 && n <= 1) n = n * 100;
    n = Math.max(0, Math.min(100, n));
    return n / 100;
  }

  function ensureButtonAudio(cb) {
    if (buttonAudio && buttonAudio.__ready) {
      if (cb) cb(buttonAudio);
      return buttonAudio;
    }
    if (!buttonAudio) buttonAudio = new Audio();
    var list = [];
    SEARCH.forEach(function (d) { list.push(d + "sfx_button.mp3"); });
    var i = 0;
    function tryNext() {
      if (i >= list.length) {
        if (cb) cb(null);
        return;
      }
      var url = list[i++];
      var done = false;
      function ok() {
        if (done) return;
        done = true;
        buttonAudio.__ready = true;
        buttonAudio.removeEventListener("canplaythrough", ok);
        buttonAudio.removeEventListener("error", bad);
        if (cb) cb(buttonAudio);
      }
      function bad() {
        if (done) return;
        done = true;
        buttonAudio.removeEventListener("canplaythrough", ok);
        buttonAudio.removeEventListener("error", bad);
        tryNext();
      }
      buttonAudio.addEventListener("canplaythrough", ok);
      buttonAudio.addEventListener("error", bad);
      try {
        buttonAudio.src = url;
        buttonAudio.load();
      } catch (e) {
        bad();
      }
    }
    tryNext();
    return buttonAudio;
  }

  function playButton() {
    try {
      if (!isEnabled()) return;
      var now = Date.now();
      if (now - lastPlay < COOLDOWN_MS) return;
      lastPlay = now;
      global.__drawRunSfxAt = lastPlay;

      var m = masterVol();
      if (m <= 0) return;
      var vol = Math.min(BUTTON_MAX, BUTTON_BASE * m);

      function doPlay(a) {
        if (!a || !a.src) return;
        try {
          var s = a.cloneNode(true);
          s.volume = vol;
          s.currentTime = 0;
          var p = s.play();
          if (p && p.catch) p.catch(function () {});
        } catch (e) {
          try {
            a.volume = vol;
            a.currentTime = 0;
            a.play().catch(function () {});
          } catch (e2) {}
        }
      }

      if (buttonAudio && buttonAudio.__ready) doPlay(buttonAudio);
      else ensureButtonAudio(function (a) { doPlay(a); });
    } catch (e) {}
  }

  function bindNavSounds() {
    document.addEventListener("click", function (e) {
      // ページ遷移リンクのみ（ボタンは game.js に任せて二重再生を防ぐ）
      var t = e.target.closest("a[href]");
      if (!t) return;
      var href = t.getAttribute("href") || "";
      if (!href || href === "#" || href.indexOf("javascript:") === 0) return;
      // 同一ページ内ハッシュのみは無視
      if (href.charAt(0) === "#") return;

      playButton();

      // target=_blank はそのまま
      if (t.target && t.target !== "_self") return;

      e.preventDefault();
      setTimeout(function () {
        window.location.href = t.href;
      }, 280);
    }, true);
  }

  global.DrawRunSE = {
    getSaved: getSaved,
    save: save,
    isEnabled: isEnabled,
    masterVol: masterVol,
    playButton: playButton,
    bindNavSounds: bindNavSounds
  };

  ensureButtonAudio(null);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindNavSounds);
  } else {
    bindNavSounds();
  }
})(window);
