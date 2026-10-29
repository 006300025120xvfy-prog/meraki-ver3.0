/**
 * DRAW RUN - Debug Tools
 * ----------------------
 * 使い方:
 *   URL に ?debug=1 を付ける  または  ゲーム中に「D」キーで ON/OFF
 *
 * 機能:
 *   I  … 無敵トグル
 *   クリック … その位置へワープ（ゲーム中のみ）
 *   ← →  … 前後にワープ
 *   ↑ ↓  … 上下にワープ
 *   + -  … プレイヤースピード倍率 UP/DOWN
 *   1〜9 … スコア 100m〜900m 付近へワープ
 *   0    … スタート地点へワープ
 *   G    … 強制ゲームオーバー
 *   C    … 強制ステージクリア
 *
 * このファイルを削除すれば本番に一切影響しません。
 */

(function () {
  "use strict";

  const urlParams = new URLSearchParams(window.location.search);
  let debugEnabled = urlParams.get("debug") === "1" ||
                     localStorage.getItem("drawRunDebug") === "1";

  // 無敵状態の小さな表示用
  let statusEl = null;

  function ensureStatus() {
    if (statusEl) return;
    const container = document.getElementById("game-container");
    if (!container) return;

    statusEl = document.createElement("div");
    statusEl.id = "debug-status";
    statusEl.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 10px;
      background: rgba(0,0,0,0.75);
      color: #0f0;
      font: bold 12px monospace;
      border-radius: 4px;
      z-index: 60;
      pointer-events: none;
      display: none;
    `;
    container.appendChild(statusEl);
  }

  function updateStatus() {
    ensureStatus();
    if (!statusEl) return;

    if (!debugEnabled) {
      statusEl.style.display = "none";
      return;
    }

    const DR = window.DRAW_RUN;
    const inv = DR && DR.invincible;
    const spd = (DR && DR.speedMul != null) ? DR.speedMul : 1;
    statusEl.style.display = "block";
    statusEl.style.color = inv ? "#0f0" : "#ff0";
    statusEl.textContent = (inv ? "DEBUG [無敵ON]" : "DEBUG") + " spd×" + spd.toFixed(2);
  }

  function setDebug(on) {
    debugEnabled = on;
    localStorage.setItem("drawRunDebug", on ? "1" : "0");

    // デバッグOFFにしたら無敵も解除
    if (!on && window.DRAW_RUN) {
      window.DRAW_RUN.invincible = false;
      window.DRAW_RUN.speedMul = 1;
    }

    updateStatus();
    console.log("[DEBUG]", on ? "ON  (I:無敵  クリック:ワープ  ←→↑↓:移動  +/-:速度  1-9:距離)" : "OFF");
  }

  function toggleDebug() {
    setDebug(!debugEnabled);
  }

  function toggleInvincible() {
    if (!debugEnabled) return;
    const DR = window.DRAW_RUN;
    if (!DR) return;
    DR.invincible = !DR.invincible;
    updateStatus();
    console.log("[DEBUG] 無敵 =", DR.invincible ? "ON" : "OFF");
  }

  // キャンバス座標 → ワールド座標
  function getWorldPoint(clientX, clientY) {
    const DR = window.DRAW_RUN;
    if (!DR || !DR.canvas) return null;
    const rect = DR.canvas.getBoundingClientRect();
    const scaleX = DR.canvas.width / rect.width;
    const scaleY = DR.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX + (DR.cameraX || 0),
      y: (clientY - rect.top) * scaleY
    };
  }

  // クリックでワープ
  function onClick(e) {
    if (!debugEnabled) return;
    const DR = window.DRAW_RUN;
    if (!DR || !DR.gameStarted || DR.gameOver || DR.gameCleared) return;

    const pt = getWorldPoint(e.clientX, e.clientY);
    if (!pt) return;

    DR.warpTo(pt.x, pt.y);
    console.log("[DEBUG] warp to", Math.round(pt.x), Math.round(pt.y));
  }

  // タッチ: 2本指でワープ（通常の描画と干渉しないように）
  function onTouch(e) {
    if (!debugEnabled) return;
    if (e.touches.length < 2) return;
    const DR = window.DRAW_RUN;
    if (!DR || !DR.gameStarted || DR.gameOver || DR.gameCleared) return;

    e.preventDefault();
    const t = e.touches[0];
    const pt = getWorldPoint(t.clientX, t.clientY);
    if (pt) {
      DR.warpTo(pt.x, pt.y);
      console.log("[DEBUG] touch warp to", Math.round(pt.x), Math.round(pt.y));
    }
  }

  window.addEventListener("keydown", (e) => {
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;

    // D でデバッグ本体のトグル
    if (e.key === "d" || e.key === "D") {
      toggleDebug();
      return;
    }

    if (!debugEnabled) return;
    const DR = window.DRAW_RUN;
    if (!DR) return;

    // I で無敵トグル
    if (e.key === "i" || e.key === "I") {
      toggleInvincible();
      return;
    }

    // ← → で前後ワープ
    if (e.key === "ArrowLeft") {
      if (DR.player) {
        DR.warpTo(DR.player.position.x - 300, DR.player.position.y);
        console.log("[DEBUG] warp -300");
      }
    }
    if (e.key === "ArrowRight") {
      if (DR.player) {
        DR.warpTo(DR.player.position.x + 500, DR.player.position.y);
        console.log("[DEBUG] warp +500");
      }
      return;
    }

    // ↑ ↓ で上下ワープ
    if (e.key === "ArrowUp") {
      if (DR.player) {
        DR.warpTo(DR.player.position.x, DR.player.position.y - 120);
        console.log("[DEBUG] warp up");
      }
      return;
    }
    if (e.key === "ArrowDown") {
      if (DR.player) {
        DR.warpTo(DR.player.position.x, DR.player.position.y + 120);
        console.log("[DEBUG] warp down");
      }
      return;
    }

    // + / - で速度倍率
    if (e.key === "+" || e.key === "=") {
      if (DR.speedMul == null) DR.speedMul = 1;
      DR.speedMul = Math.min(3, Math.round((DR.speedMul + 0.1) * 100) / 100);
      updateStatus();
      console.log("[DEBUG] speedMul =", DR.speedMul);
      return;
    }
    if (e.key === "-" || e.key === "_") {
      if (DR.speedMul == null) DR.speedMul = 1;
      DR.speedMul = Math.max(0.2, Math.round((DR.speedMul - 0.1) * 100) / 100);
      updateStatus();
      console.log("[DEBUG] speedMul =", DR.speedMul);
      return;
    }

    // 0〜9 でスコア位置へワープ（0=スタート、1=100m … 9=900m）
    if (e.key >= "0" && e.key <= "9") {
      const n = parseInt(e.key, 10);
      const targetScore = n * 100;
      // score = floor((x - 200) / 100)  →  x = score * 100 + 200
      const worldX = targetScore * 100 + 200;
      const groundY = 700 - 80; // 地面付近
      DR.warpTo(worldX, groundY);
      console.log("[DEBUG] warp to ~" + targetScore + "m");
    }

    // G 強制ゲームオーバー（一時的に無敵を外して実行）
    if (e.key === "g" || e.key === "G") {
      if (DR.gameStarted && !DR.gameOver && !DR.gameCleared) {
        const wasInv = DR.invincible;
        DR.invincible = false;
        DR.triggerGameOver();
        DR.invincible = wasInv;
        console.log("[DEBUG] force Game Over");
      }
    }

    // C 強制クリア
    if (e.key === "c" || e.key === "C") {
      if (DR.gameStarted && !DR.gameOver && !DR.gameCleared &&
          DR.currentConfig && !DR.currentConfig.isInfinite) {
        DR.triggerGameClear();
        console.log("[DEBUG] force Stage Clear");
      }
    }
  });

  window.addEventListener("click", onClick);
  window.addEventListener("touchstart", onTouch, { passive: false });

  // 起動
  if (debugEnabled) {
    const ready = () => {
      updateStatus();
      if (window.DRAW_RUN) {
        window.DRAW_RUN.invincible = true; // デバッグ開始時は最初から無敵
        updateStatus();
      }
      console.log("[DEBUG] enabled");
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", ready);
    } else {
      setTimeout(ready, 100);
    }
  }

  window.DRAW_RUN_DEBUG = {
    toggle: toggleDebug,
    toggleInvincible,
    isEnabled: () => debugEnabled
  };
})();
