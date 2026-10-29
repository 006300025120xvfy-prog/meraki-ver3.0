// --- DRAW RUN - メインゲームスクリプト（モード追加版） ---

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 400;
canvas.height = 700;

const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;

const engine = Engine.create();
const world = engine.world;

const normalGravityY = 0.7;
engine.world.gravity.y = normalGravityY;

// --- 画像の読み込み ---



// 素材パス：ルートでも map/skin/UI/sound/assets でも、バラバラ配置でも動く
const ASSET_SEARCH_DIRS = [
  "",
  "map/",
  "map/landmark/",
  "landmark/",
  "landmarks/",
  "skin/",
  "UI/",
  "ui/",
  "sound/",
  "assets/",
  "assets/map/",
  "assets/landmark/",
  "assets/skin/",
  "assets/UI/",
  "assets/ui/",
  "assets/sound/",
  "img/",
  "images/",
  "audio/"
];
function assetDirCandidates(name) {
  const n = String(name || "").replace(/^\.?\//, "");
  // すでにパス付きで渡された場合も、ファイル名だけ抜いて全候補を試す
  const base = n.split("/").pop();
  const seen = {};
  const list = [];
  function add(p) {
    if (!p || seen[p]) return;
    seen[p] = true;
    list.push(p);
  }
  // 渡されたパスそのまま
  add(n);
  // 各フォルダ + ファイル名
  ASSET_SEARCH_DIRS.forEach((d) => add(d + base));
  return list;
}
function loadAssetImage(img, name) {
  const list = assetDirCandidates(name);
  let i = 0;
  const tryNext = () => {
    if (i >= list.length) return;
    const url = list[i++];
    img.onload = null;
    img.onerror = function () { tryNext(); };
    img.src = url;
  };
  tryNext();
}
function loadAssetAudio(audio, name) {
  const list = assetDirCandidates(name);
  let i = 0;
  const tryNext = () => {
    if (i >= list.length) return;
    const url = list[i++];
    const onErr = function () {
      audio.removeEventListener("error", onErr);
      tryNext();
    };
    audio.addEventListener("error", onErr);
    try { audio.src = url; audio.load(); } catch (e) { tryNext(); }
  };
  tryNext();
}
// HTML用：複数パスを順に試す
function bindFlexibleAsset(el, name) {
  if (!el || !name) return;
  const list = assetDirCandidates(name);
  let i = 0;
  const tryNext = () => {
    if (i >= list.length) return;
    const url = list[i++];
    if (el.tagName === "AUDIO" || el.tagName === "VIDEO") {
      const onErr = function () {
        el.removeEventListener("error", onErr);
        tryNext();
      };
      el.addEventListener("error", onErr);
      el.src = url;
      try { el.load(); } catch (e) {}
    } else {
      el.onerror = function () { tryNext(); };
      el.src = url;
    }
  };
  tryNext();
}
window.bindFlexibleAsset = bindFlexibleAsset;
window.assetDirCandidates = assetDirCandidates;


const groundImage = new Image();
loadAssetImage(groundImage, "ground.jpg");

const bgAozora = new Image();
loadAssetImage(bgAozora, "sougen.png");

const bgYuugure = new Image();
loadAssetImage(bgYuugure, "yuugure.jpeg");

const bgYozora = new Image();
loadAssetImage(bgYozora, "yozora.png");

const bgCyber = new Image();
loadAssetImage(bgCyber, "syber.jpg");

const bgVolcano = new Image();
loadAssetImage(bgVolcano, "volcano.png");

const spikeImage = new Image();
loadAssetImage(spikeImage, "spike.png");

const ringImage = new Image();
loadAssetImage(ringImage, "ring.png");

const normalRingImage = new Image();
loadAssetImage(normalRingImage, "normal_ring.png");

const warpItemImage = new Image();
loadAssetImage(warpItemImage, "warp_item.png");

const wallImage = new Image();
loadAssetImage(wallImage, "wall.png");

// --- 音声ファイルの読み込みと音量設定 ---
const deathSound = (function(){ const a = new Audio(); loadAssetAudio(a, "death.mp3"); return a; })();
deathSound.volume = 0.03;
const playBGM = (function(){ const a = new Audio(); loadAssetAudio(a, "play.mp3"); return a; })();
playBGM.loop = true; 
playBGM.volume = 0.03;

// ===== 効果音（HOW TO画面の設定を全ページ共通で使用） =====
const SFX_BASE_VOLUME = {
  death: 0.03,
  countdown: 0.12,
  clear: 0.08,
  button: 0.12
};

const sfxCountdown = new Audio();
loadAssetAudio(sfxCountdown, "sfx_countdown.mp3");
sfxCountdown.preload = "auto";

const sfxClear = new Audio();
loadAssetAudio(sfxClear, "sfx_clear.mp3");
sfxClear.preload = "auto";

const sfxButton = new Audio();
loadAssetAudio(sfxButton, "sfx_button.mp3");
sfxButton.preload = "auto";

// ===== 効果音設定（ページを移動・ゲームオーバーしても維持） =====
function getSavedSeValue(key) {
  try {
    const localValue = localStorage.getItem(key);
    if (localValue !== null) return localValue;
  } catch (e) {}

  try {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue !== null) return sessionValue;
  } catch (e) {}

  return null;
}

function saveSeValue(key, value) {
  const stringValue = String(value);

  try {
    localStorage.setItem(key, stringValue);
  } catch (e) {}

  try {
    sessionStorage.setItem(key, stringValue);
  } catch (e) {}
}

// 設定が一度も保存されていない場合だけ初期値を作る。
// 既存の設定値は絶対に上書きしない。
if (getSavedSeValue("drawRunSeEnabled") === null) {
  saveSeValue("drawRunSeEnabled", "true");
}
if (getSavedSeValue("drawRunSeVolume") === null) {
  saveSeValue("drawRunSeVolume", "28");
}

function isSeEnabled() {
  return getSavedSeValue("drawRunSeEnabled") !== "false";
}

function getSeMasterVolume() {
  const value = Number(getSavedSeValue("drawRunSeVolume"));
  if (!Number.isFinite(value)) return 0.28;
  return Math.max(0, Math.min(100, value)) / 100;
}

function playSfx(audio, baseVolume = 0.12) {
  try {
    if (!audio || !isSeEnabled()) return;

    let masterVolume = getSeMasterVolume();
    // 0〜1 で誤保存されていた場合
    if (masterVolume > 0 && masterVolume <= 0.01) {
      const raw = Number(getSavedSeValue("drawRunSeVolume"));
      if (Number.isFinite(raw) && raw > 0 && raw <= 1) masterVolume = raw;
    }
    if (masterVolume <= 0) return;

    // ボタン等は最大でも控えめに
    const vol = Math.max(0, Math.min(0.35, baseVolume * masterVolume));
    audio.volume = vol;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (e) {}
}

function playCountdownSfx() {
  playSfx(sfxCountdown, SFX_BASE_VOLUME.countdown);
}

let __btnSfxAt = 0;
function playButtonSfx() {
  const now = Date.now();
  // se-common と共有クールダウン（二重再生防止）
  const shared = window.__drawRunSfxAt || 0;
  if (now - __btnSfxAt < 150 || now - shared < 150) return;
  __btnSfxAt = now;
  window.__drawRunSfxAt = now;
  playSfx(sfxButton, SFX_BASE_VOLUME.button);
}

function playClearSfx() {
  playSfx(sfxClear, SFX_BASE_VOLUME.clear);
}

function playDeathSfx() {
  playSfx(deathSound, SFX_BASE_VOLUME.death);
}

const characterList = [
  { src: "player.png", name: "クロカゲ", unlock: null },
  { src: "player2.png", name: "ハムゾウ", unlock: null },
  { src: "player3.png", name: "マフィン", unlock: null },
  { src: "player4.png", name: "ロビン・ドングリ", unlock: null },
  { src: "player5.png", name: "サー・ロデリック", unlock: null },
  { src: "player6.png", name: "ダスティ・アイアンヒゲ", unlock: null },
  { src: "player7.png", name: "キャプテン・バーナビー", unlock: "score200", unlockText: "スコアアタックで200m達成" },
  { src: "player8.png", name: "ネオン・サイファー", unlock: "stage4all", unlockText: "STAGE1〜4をすべてクリア" }
];

function getBestScoreAttack() {
  let best = 0;
  try {
    const scores = JSON.parse(localStorage.getItem("drawRunScores")) || [];
    scores.forEach((s) => {
      const v = typeof s === "object" && s ? Number(s.score) : Number(s);
      if (Number.isFinite(v) && v > best) best = v;
    });
  } catch (e) {}
  try {
    const last = JSON.parse(localStorage.getItem("drawRunLastScore"));
    if (last && Number.isFinite(Number(last.score)) && Number(last.score) > best) best = Number(last.score);
  } catch (e) {}
  try {
    const hi = Number(localStorage.getItem("drawRunBestScore"));
    if (Number.isFinite(hi) && hi > best) best = hi;
  } catch (e) {}
  return best;
}

function isStageRangeFullyCleared(maxMain) {
  let cleared = {};
  try { cleared = JSON.parse(localStorage.getItem("drawRunStageClears")) || {}; } catch (e) {}
  for (let m = 1; m <= maxMain; m++) {
    for (let s = 1; s <= 3; s++) {
      if (!cleared["stage" + m + "-" + s]) return false;
    }
  }
  return true;
}

function isCharacterUnlocked(index) {
  const char = characterList[index];
  if (!char || !char.unlock) return true;
  if (char.unlock === "score200") return getBestScoreAttack() >= 200;
  if (char.unlock === "stage4all") return isStageRangeFullyCleared(4);
  return true;
}

const playerImages = characterList.map((char) => {
  const img = new Image();
  loadAssetImage(img, char.src);
  return img;
});

let currentSkinIndex = parseInt(localStorage.getItem('drawRunSkinIndex')) || 0;
if (currentSkinIndex < 0 || currentSkinIndex >= characterList.length) {
  currentSkinIndex = 0;
}
if (!isCharacterUnlocked(currentSkinIndex)) {
  currentSkinIndex = 0;
  try { localStorage.setItem("drawRunSkinIndex", "0"); } catch (e) {}
}

// ===== モード設定 =====
const MODE_CONFIG = {
  score: {
    name: "スコアアタック",
    isInfinite: true,
    targetScore: null,
    holeChance: 0.50,
    minHoleWidth: 200,
    maxHoleWidthFactor: 0.80,
    wallHeightMin: 70,
    wallHeightMax: 180,
    minSafeDistance: 400,
    baseSpeed: 4.0,
    airborneGravityStart: 120,
    gravityIncrease: 0.15,
    bgFixed: null,
    laserEnabled: true,
    laserStartScore: 400,
    laserCooldownMin: 200,
    laserCooldownMax: 320,
    gravityReverseEnabled: true,
    gravityReverseStartScore: 200,
    ringEnabled: true,
    ringChance: 0.14,
    normalRingChance: 0.12,
    spikeEnabled: true,
    spikeStartScore: 100,
    warpItemEnabled: true,
    warpItemChance: 0.40,
    fakeFloorEnabled: true,
    fakeFloorChance: 0.22,
    groundSpikeEnabled: true,
    groundSpikeStartScore: 80
  },

  "stage1-1": {
    name: "STAGE 1-1", mainStage: 1, subStage: 1, isInfinite: false,
    targetScore: 50,
    holeChance: 0.25, minHoleWidth: 150, maxHoleWidthFactor: 0.50,
    wallHeightMin: 70, wallHeightMax: 150, minSafeDistance: 550,
    baseSpeed: 3.5, airborneGravityStart: 160, gravityIncrease: 0.08,
    bgFixed: "aozora",
    laserEnabled: false,
    ringEnabled: false,
    spikeEnabled: false,
    gravityReverseEnabled: false,
    warpItemEnabled: false
  },
  "stage1-2": {
    name: "STAGE 1-2", mainStage: 1, subStage: 2, isInfinite: false,
    targetScore: 75,
    holeChance: 0.30, minHoleWidth: 160, maxHoleWidthFactor: 0.55,
    wallHeightMin: 80, wallHeightMax: 180, minSafeDistance: 500,
    baseSpeed: 3.6, airborneGravityStart: 150, gravityIncrease: 0.10,
    bgFixed: "aozora",
    laserEnabled: false,
    ringEnabled: false,
    spikeEnabled: false,
    gravityReverseEnabled: false,
    warpItemEnabled: false
  },
  "stage1-3": {
    name: "STAGE 1-3", mainStage: 1, subStage: 3, isInfinite: false,
    targetScore: 100,
    holeChance: 0.35, minHoleWidth: 170, maxHoleWidthFactor: 0.60,
    wallHeightMin: 90, wallHeightMax: 200, minSafeDistance: 460,
    baseSpeed: 3.7, airborneGravityStart: 140, gravityIncrease: 0.11,
    bgFixed: "aozora",
    laserEnabled: false,
    ringEnabled: false,
    spikeEnabled: false,
    gravityReverseEnabled: false,
    warpItemEnabled: false
  },

  "stage2-1": {
    name: "STAGE 2-1", mainStage: 2, subStage: 1, isInfinite: false,
    targetScore: 75,
    holeChance: 0.35, minHoleWidth: 170, maxHoleWidthFactor: 0.58,
    wallHeightMin: 90, wallHeightMax: 210, minSafeDistance: 450,
    baseSpeed: 3.7, airborneGravityStart: 140, gravityIncrease: 0.11,
    bgFixed: "yuugure",
    laserEnabled: false,
    ringEnabled: true,
    ringChance: 0.16,
    normalRingChance: 0.10,
    spikeEnabled: false,
    gravityReverseEnabled: false,
    warpItemEnabled: true,
    warpItemChance: 0.30
  },
  "stage2-2": {
    name: "STAGE 2-2", mainStage: 2, subStage: 2, isInfinite: false,
    targetScore: 100,
    holeChance: 0.40, minHoleWidth: 180, maxHoleWidthFactor: 0.65,
    wallHeightMin: 100, wallHeightMax: 240, minSafeDistance: 420,
    baseSpeed: 3.9, airborneGravityStart: 130, gravityIncrease: 0.13,
    bgFixed: "yuugure",
    laserEnabled: false,
    ringEnabled: true,
    ringChance: 0.16,
    normalRingChance: 0.10,
    spikeEnabled: false,
    gravityReverseEnabled: false,
    warpItemEnabled: true,
    warpItemChance: 0.30
  },
  "stage2-3": {
    name: "STAGE 2-3", mainStage: 2, subStage: 3, isInfinite: false,
    targetScore: 100,
    holeChance: 0.45, minHoleWidth: 190, maxHoleWidthFactor: 0.70,
    wallHeightMin: 110, wallHeightMax: 270, minSafeDistance: 390,
    baseSpeed: 4.0, airborneGravityStart: 120, gravityIncrease: 0.14,
    bgFixed: "yuugure",
    laserEnabled: false,
    ringEnabled: true,
    ringChance: 0.16,
    normalRingChance: 0.10,
    spikeEnabled: false,
    gravityReverseEnabled: false,
    warpItemEnabled: true,
    warpItemChance: 0.30
  },

  "stage3-1": {
    name: "STAGE 3-1", mainStage: 3, subStage: 1, isInfinite: false,
    targetScore: 75,
    holeChance: 0.42, minHoleWidth: 185, maxHoleWidthFactor: 0.68,
    wallHeightMin: 110, wallHeightMax: 260, minSafeDistance: 400,
    baseSpeed: 4.0, airborneGravityStart: 120, gravityIncrease: 0.14,
    bgFixed: "yozora",
    laserEnabled: true, laserStartScore: 20,
    laserCooldownMin: 220, laserCooldownMax: 340,
    ringEnabled: true,
    ringChance: 0.16,
    normalRingChance: 0.10,
    spikeEnabled: false,
    gravityReverseEnabled: false,
    warpItemEnabled: true,
    warpItemChance: 0.28
  },
  "stage3-2": {
    name: "STAGE 3-2", mainStage: 3, subStage: 2, isInfinite: false,
    targetScore: 100,
    holeChance: 0.48, minHoleWidth: 195, maxHoleWidthFactor: 0.72,
    wallHeightMin: 120, wallHeightMax: 290, minSafeDistance: 370,
    baseSpeed: 4.15, airborneGravityStart: 110, gravityIncrease: 0.15,
    bgFixed: "yozora",
    laserEnabled: true, laserStartScore: 20,
    laserCooldownMin: 220, laserCooldownMax: 340,
    ringEnabled: true,
    ringChance: 0.16,
    normalRingChance: 0.10,
    spikeEnabled: false,
    gravityReverseEnabled: false,
    warpItemEnabled: true,
    warpItemChance: 0.28
  },
  "stage3-3": {
    name: "STAGE 3-3", mainStage: 3, subStage: 3, isInfinite: false,
    targetScore: 100,
    holeChance: 0.52, minHoleWidth: 205, maxHoleWidthFactor: 0.76,
    wallHeightMin: 125, wallHeightMax: 310, minSafeDistance: 350,
    baseSpeed: 4.25, airborneGravityStart: 105, gravityIncrease: 0.16,
    bgFixed: "yozora",
    laserEnabled: true, laserStartScore: 20,
    laserCooldownMin: 220, laserCooldownMax: 340,
    ringEnabled: true,
    ringChance: 0.16,
    normalRingChance: 0.10,
    spikeEnabled: false,
    gravityReverseEnabled: false,
    warpItemEnabled: true,
    warpItemChance: 0.28
  },

  "stage4-1": {
    name: "STAGE 4-1", mainStage: 4, subStage: 1, isInfinite: false,
    targetScore: 150,
    holeChance: 0.48, minHoleWidth: 200, maxHoleWidthFactor: 0.75,
    wallHeightMin: 130, wallHeightMax: 320, minSafeDistance: 340,
    baseSpeed: 4.2, airborneGravityStart: 100, gravityIncrease: 0.17,
    bgFixed: "cyber",
    laserEnabled: true, laserStartScore: 15,
    laserCooldownMin: 150, laserCooldownMax: 260,
    ringEnabled: true,
    ringChance: 0.18,
    normalRingChance: 0.12,
    spikeEnabled: true, spikeStartScore: 20,
    gravityReverseEnabled: true, gravityReverseStartScore: 25,
    warpItemEnabled: true,
    warpItemChance: 0.32
  },
  "stage4-2": {
    name: "STAGE 4-2", mainStage: 4, subStage: 2, isInfinite: false,
    targetScore: 150,
    holeChance: 0.54, minHoleWidth: 210, maxHoleWidthFactor: 0.80,
    wallHeightMin: 140, wallHeightMax: 340, minSafeDistance: 310,
    baseSpeed: 4.4, airborneGravityStart: 95, gravityIncrease: 0.19,
    bgFixed: "cyber",
    laserEnabled: true, laserStartScore: 15,
    laserCooldownMin: 150, laserCooldownMax: 260,
    ringEnabled: true,
    ringChance: 0.18,
    normalRingChance: 0.12,
    spikeEnabled: true, spikeStartScore: 20,
    gravityReverseEnabled: true, gravityReverseStartScore: 25,
    warpItemEnabled: true,
    warpItemChance: 0.32
  },
  "stage4-3": {
    name: "STAGE 4-3", mainStage: 4, subStage: 3, isInfinite: false,
    targetScore: 150,
    holeChance: 0.58, minHoleWidth: 220, maxHoleWidthFactor: 0.85,
    wallHeightMin: 150, wallHeightMax: 370, minSafeDistance: 280,
    baseSpeed: 4.55, airborneGravityStart: 85, gravityIncrease: 0.21,
    bgFixed: "cyber",
    laserEnabled: true, laserStartScore: 15,
    laserCooldownMin: 150, laserCooldownMax: 260,
    ringEnabled: true,
    ringChance: 0.18,
    normalRingChance: 0.12,
    spikeEnabled: true, spikeStartScore: 20,
    gravityReverseEnabled: true, gravityReverseStartScore: 25,
    warpItemEnabled: true,
    warpItemChance: 0.32
  },

  "stage5-1": {
    name: "STAGE 5-1", mainStage: 5, subStage: 1, isInfinite: false,
    targetScore: 150,
    holeChance: 0.50, minHoleWidth: 200, maxHoleWidthFactor: 0.78,
    wallHeightMin: 120, wallHeightMax: 280, minSafeDistance: 300,
    baseSpeed: 4.4, airborneGravityStart: 95, gravityIncrease: 0.18,
    bgFixed: "volcano",
    laserEnabled: true, laserStartScore: 40,
    laserCooldownMin: 180, laserCooldownMax: 280,
    ringEnabled: true, ringChance: 0.14, normalRingChance: 0.10,
    spikeEnabled: true, spikeStartScore: 30,
    gravityReverseEnabled: true, gravityReverseStartScore: 50,
    warpItemEnabled: true, warpItemChance: 0.30,
    blinkPlatformEnabled: true, blinkPlatformChance: 0.28,
    windEnabled: false
  },
  "stage5-2": {
    name: "STAGE 5-2", mainStage: 5, subStage: 2, isInfinite: false,
    targetScore: 175,
    holeChance: 0.54, minHoleWidth: 210, maxHoleWidthFactor: 0.80,
    wallHeightMin: 130, wallHeightMax: 300, minSafeDistance: 280,
    baseSpeed: 4.5, airborneGravityStart: 90, gravityIncrease: 0.19,
    bgFixed: "volcano",
    laserEnabled: true, laserStartScore: 30,
    laserCooldownMin: 160, laserCooldownMax: 260,
    ringEnabled: true, ringChance: 0.15, normalRingChance: 0.11,
    spikeEnabled: true, spikeStartScore: 25,
    gravityReverseEnabled: true, gravityReverseStartScore: 40,
    warpItemEnabled: true, warpItemChance: 0.32,
    blinkPlatformEnabled: true, blinkPlatformChance: 0.32,
    windEnabled: false
  },
  "stage5-3": {
    name: "STAGE 5-3", mainStage: 5, subStage: 3, isInfinite: false,
    targetScore: 200,
    holeChance: 0.56, minHoleWidth: 220, maxHoleWidthFactor: 0.82,
    wallHeightMin: 140, wallHeightMax: 320, minSafeDistance: 260,
    baseSpeed: 4.6, airborneGravityStart: 85, gravityIncrease: 0.20,
    bgFixed: "volcano",
    laserEnabled: true, laserStartScore: 20,
    laserCooldownMin: 140, laserCooldownMax: 240,
    ringEnabled: true, ringChance: 0.16, normalRingChance: 0.12,
    spikeEnabled: true, spikeStartScore: 20,
    gravityReverseEnabled: true, gravityReverseStartScore: 30,
    warpItemEnabled: true, warpItemChance: 0.34,
    blinkPlatformEnabled: true, blinkPlatformChance: 0.36,
    windEnabled: false
  },

};

let currentMode = null;          
let currentConfig = null;        
let gameStarted = false;
let gameOver = false;
let gameCleared = false;

const player = Bodies.circle(200, canvas.height / 2, 20, {
  friction: 0.1,
  frictionStatic: 0.2,
  restitution: 0,
  inertia: Infinity
});
World.add(world, player);

let score = 0; 
let cameraX = 0;

let playerSpeed = 4;
let stoppedTime = 0;

const baseHoleSize = 400;
const maxDrawLength = baseHoleSize * 1.5;
function getEffectiveMaxDrawLength() {
  // 強化1回ごとに約35%延長（最大3回 → 約2倍）
  const lv = Math.max(0, Math.min(LINE_EXTEND_MAX, lineExtendLevel || 0));
  return maxDrawLength * (1 + 0.35 * lv);
}
function getEffectiveMaxDrawTime() {
  const lv = Math.max(0, Math.min(LINE_EXTEND_MAX, lineExtendLevel || 0));
  return maxDrawTime * (1 + 0.25 * lv);
}

const cooldownDuration = 160; 
let lastReleaseTime = 0;      

let airborneFrames = 0;
let isTouchingGroundOrLine = false;
let upperZoneFrames = 0;

let activeGimmick = null; 

function tryStartGimmick(name) {
  if (activeGimmick !== null) return false;
  activeGimmick = name;
  return true;
}
function endGimmick(name) {
  if (activeGimmick === name) activeGimmick = null;
}

// ===== レーザーギミック（3レーン） =====
const LANE_COUNT = 3;
const LANE_H = canvas.height / LANE_COUNT;
let laserState = "idle";
let laserSafeLane = 1;          
let laserTimer = 0;             
const LASER_WARNING_FRAMES = 150;  
const LASER_ACTIVE_FRAMES = 120;   
const LASER_COOLDOWN_MIN = 200;    
const LASER_COOLDOWN_MAX = 320;    
let laserCooldownTarget = 240;

function isLaserModeActive() {
  if (!currentMode || !currentConfig) return false;
  if (!currentConfig.laserEnabled) return false;
  const startAt = currentConfig.laserStartScore != null ? currentConfig.laserStartScore : 400;
  return score >= startAt;
}

function startLaserWarning() {
  if (!tryStartGimmick("laser")) return;
  laserSafeLane = Math.floor(Math.random() * LANE_COUNT);
  laserState = "warning";
  laserTimer = 0;
}

function updateLaserGimmick() {
  if (!isLaserModeActive()) {
    if (laserState !== "idle") {
      endGimmick("laser");
    }
    laserState = "idle";
    laserTimer = 0;
    return;
  }

  laserTimer++;

  if (laserState === "idle") {
    startLaserWarning();
  } else if (laserState === "warning") {
    if (laserTimer >= LASER_WARNING_FRAMES) {
      laserState = "active";
      laserTimer = 0;
    }
  } else if (laserState === "active") {
    const py = player.position.y;
    const playerLane = Math.min(LANE_COUNT - 1, Math.max(0, Math.floor(py / LANE_H)));
    const safeLane = isGravityVisualFlipped() ? (LANE_COUNT - 1 - laserSafeLane) : laserSafeLane;
    if (playerLane !== safeLane) {
      triggerGameOver();
    }
    if (laserTimer >= LASER_ACTIVE_FRAMES) {
      laserState = "cooldown";
      laserTimer = 0;
      const cMin = (currentConfig && currentConfig.laserCooldownMin != null) ? currentConfig.laserCooldownMin : LASER_COOLDOWN_MIN;
      const cMax = (currentConfig && currentConfig.laserCooldownMax != null) ? currentConfig.laserCooldownMax : LASER_COOLDOWN_MAX;
      laserCooldownTarget = cMin + Math.floor(Math.random() * (cMax - cMin + 1));
    }
  } else if (laserState === "cooldown") {
    if (laserTimer >= laserCooldownTarget) {
      laserState = "idle";
      laserTimer = 0;
      endGimmick("laser");
    }
  }
}

function drawLaserGimmick() {
  if (laserState !== "warning" && laserState !== "active") return;

  const now = Date.now();

  for (let i = 0; i < LANE_COUNT; i++) {
    const safeLane = isGravityVisualFlipped() ? (LANE_COUNT - 1 - laserSafeLane) : laserSafeLane;
    if (i === safeLane) continue;

    const y = i * LANE_H;
    const h = LANE_H;

    if (laserState === "warning") {
      const flash = Math.sin(now / 80) > 0;
      if (flash) {
        ctx.fillStyle = "rgba(255, 40, 40, 0.25)";
        ctx.fillRect(0, y, canvas.width, h);

        ctx.strokeStyle = "rgba(255, 80, 80, 0.9)";
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.strokeRect(2, y + 2, canvas.width - 4, h - 4);
        ctx.setLineDash([]);
      }

      ctx.save();
      ctx.font = "bold 22px 'Helvetica Neue', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = flash ? "#ff2244" : "#ffaaaa";
      ctx.shadowColor = "rgba(255,0,0,0.8)";
      ctx.shadowBlur = 12;
      ctx.fillText("⚠ LASER WARNING ⚠", canvas.width / 2, y + h / 2);
      ctx.restore();
    } else if (laserState === "active") {
      const pulse = 0.55 + 0.25 * Math.sin(now / 40);

      ctx.fillStyle = `rgba(255, 20, 60, ${0.15 * pulse})`;
      ctx.fillRect(0, y, canvas.width, h);

      const beamH = 18;
      const beamY = y + h / 2 - beamH / 2;
      const grad = ctx.createLinearGradient(0, beamY, 0, beamY + beamH);
      grad.addColorStop(0, "rgba(255, 100, 150, 0)");
      grad.addColorStop(0.3, `rgba(255, 40, 80, ${0.9 * pulse})`);
      grad.addColorStop(0.5, `rgba(255, 255, 255, ${pulse})`);
      grad.addColorStop(0.7, `rgba(255, 40, 80, ${0.9 * pulse})`);
      grad.addColorStop(1, "rgba(255, 100, 150, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, beamY, canvas.width, beamH);

      ctx.strokeStyle = `rgba(255, 80, 120, ${0.8 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, beamY);
      ctx.lineTo(canvas.width, beamY);
      ctx.moveTo(0, beamY + beamH);
      ctx.lineTo(canvas.width, beamY + beamH);
      ctx.stroke();
    }
  }

  if (laserState === "warning" || laserState === "active") {
    const safeLane = isGravityVisualFlipped() ? (LANE_COUNT - 1 - laserSafeLane) : laserSafeLane;
    const sy = safeLane * LANE_H;
    ctx.fillStyle = "rgba(0, 255, 120, 0.08)";
    ctx.fillRect(0, sy, canvas.width, LANE_H);
    ctx.strokeStyle = "rgba(0, 255, 120, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(1, sy + 1, canvas.width - 2, LANE_H - 2);
    ctx.setLineDash([]);
  }
}

// ===== 重力反転ギミック =====
// 時間ではなく「スコア（=進行距離）」で区間を管理する。
// 1つの重力反転区間は100m、区間と区間の間は300m。
const GR_ZONE_LENGTH = 100;
const GR_ZONE_INTERVAL = 300;
const GR_WARNING_DISTANCE = 20;

let gravityReverseState = "idle";

// ===== 重力反転のワールド状態 =====
// 重力反転の瞬間に既存オブジェクトを上下移動させない。
// 既存の地面・壁・障害物はその場に残し、重力だけを反転する。
// 反転中に新しく生成する地形は上側を基準に生成する。
let gravityWorldFlipped = false;

function isGravityVisualFlipped() {
  return gravityReverseState === "active";
}

function setGravityWorldFlipped(flipped) {
  if (gravityWorldFlipped === flipped) return;
  gravityWorldFlipped = flipped;

  // 既存の地面・壁・足場を上下反転して「天井側の床」を作る
  // （これをしないと上に地面がなく無限に飛んでいく）
  const flipY = (y) => canvas.height - y;
  function flipBody(body) {
    if (!body) return;
    try {
      Body.setPosition(body, { x: body.position.x, y: flipY(body.position.y) });
      // 速度は反転重力に任せる（位置だけ合わせる）
    } catch (e) {}
  }

  grounds.forEach(flipBody);
  walls.forEach(flipBody);
  try {
    currentLines.forEach(flipBody);
  } catch (e) {}
  try {
    spikes.forEach(flipBody);
  } catch (e) {}
  try {
    blinkPlatforms.forEach((bp) => {
      if (bp.body) flipBody(bp.body);
      bp.y = flipY(bp.y);
    });
  } catch (e) {}
  try {
    fakeFloors.forEach((ff) => { ff.y = flipY(ff.y); });
  } catch (e) {}
  try {
    rings.forEach((r) => { r.y = flipY(r.y); });
  } catch (e) {}
  try {
    warpPickups.forEach((w) => { w.y = flipY(w.y); });
  } catch (e) {}

  // プレイヤーは位置を維持（重力方向だけ変わる）
  // ただし画面外に出ている場合は中央付近へ軽く戻す
  try {
    if (player) {
      const py = player.position.y;
      if (py < 20 || py > canvas.height - 20) {
        Body.setPosition(player, { x: player.position.x, y: canvas.height / 2 });
        Body.setVelocity(player, { x: player.velocity.x, y: 0 });
      }
    }
  } catch (e) {}
}

function getGravityZoneInfo() {
  if (!currentConfig || !currentConfig.gravityReverseEnabled) return null;

  const firstStart = currentConfig.gravityReverseStartScore != null
    ? currentConfig.gravityReverseStartScore
    : 200;

  // 最初の区間より前なら何も起こさない。
  if (score < firstStart - GR_WARNING_DISTANCE) return null;

  // 進行距離に応じて現在の重力反転区間を決める。
  // 例: firstStart=200 の場合
  //  180〜199m: WARNING
  //  200〜299m: ACTIVE
  //  300〜479m: 通常
  //  480〜499m: WARNING
  //  500〜599m: ACTIVE という形で繰り返す。
  let zoneIndex = 0;
  if (score >= firstStart) {
    zoneIndex = Math.floor((score - firstStart) / GR_ZONE_INTERVAL);
  }

  const zoneStart = firstStart + zoneIndex * GR_ZONE_INTERVAL;
  const zoneEnd = zoneStart + GR_ZONE_LENGTH;
  const warningStart = zoneStart - GR_WARNING_DISTANCE;

  return {
    zoneIndex,
    zoneStart,
    zoneEnd,
    warningStart,
    isWarning: score >= warningStart && score < zoneStart,
    isActive: score >= zoneStart && score < zoneEnd
  };
}

function updateGravityReverseGimmick() {
  const warnEl = document.getElementById("gravity-warning");
  const zone = getGravityZoneInfo();

  if (!zone) {
    gravityReverseState = "idle";
    engine.world.gravity.y = normalGravityY;
    setGravityWorldFlipped(false);
    activeGimmick = activeGimmick === "gravityReverse" ? null : activeGimmick;
    if (warnEl) warnEl.classList.add("hidden");
    return;
  }

  if (zone.isWarning) {
    gravityReverseState = "warning";
    engine.world.gravity.y = Math.abs(normalGravityY);
    if (warnEl) warnEl.classList.remove("hidden");

    // WARNING中はまだ反転しない。
    setGravityWorldFlipped(false);
    if (activeGimmick === "gravityReverse") activeGimmick = null;
    return;
  }

  if (zone.isActive) {
    gravityReverseState = "active";
    engine.world.gravity.y = -Math.abs(normalGravityY) * 1.2;
    setGravityWorldFlipped(true);
    activeGimmick = "gravityReverse";
    if (warnEl) warnEl.classList.add("hidden");
    return;
  }

  // 区間終了後は通常重力に戻る。
  gravityReverseState = "idle";
  engine.world.gravity.y = normalGravityY;
  setGravityWorldFlipped(false);
  if (activeGimmick === "gravityReverse") activeGimmick = null;
  if (warnEl) warnEl.classList.add("hidden");
}

function getGoalWorldX() {
  if (!currentConfig || currentConfig.isInfinite || currentConfig.targetScore == null) return null;
  return currentConfig.targetScore * 100 + 200;
}

function drawGoal() {
  const gx = getGoalWorldX();
  if (gx == null) return;
  const sx = gx - cameraX;
  if (sx < -80 || sx > canvas.width + 80) return;

  const groundY = isGravityVisualFlipped() ? 80 : canvas.height - 80;
  const poleH = 220;
  const poleW = 10;
  const archW = 70;

  ctx.save();

  ctx.fillStyle = "#f5d76e";
  ctx.fillRect(sx - archW / 2 - poleW, groundY - poleH, poleW, poleH);
  ctx.fillRect(sx + archW / 2, groundY - poleH, poleW, poleH);

  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(sx - archW / 2 - poleW, groundY - poleH, archW + poleW * 2, 28);

  ctx.font = "bold 18px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;
  ctx.fillText("GOAL", sx, groundY - poleH + 14);

  const bandY = groundY - 8;
  const bandH = 12;
  const cell = 12;
  for (let i = -4; i <= 4; i++) {
    ctx.fillStyle = (i % 2 === 0) ? "#111" : "#fff";
    ctx.fillRect(sx + i * cell - cell / 2, bandY, cell, bandH);
  }

  const pulse = 0.4 + 0.3 * Math.sin(Date.now() / 200);
  ctx.strokeStyle = `rgba(255, 220, 50, ${pulse})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(sx - archW / 2 - poleW - 2, groundY - poleH - 2, archW + poleW * 2 + 4, poleH + 4);

  ctx.restore();
}


// ===== プレイ統計（ローカル） =====
function loadPlayStats() {
  try {
    const s = JSON.parse(localStorage.getItem("drawRunPlayStats"));
    if (s && typeof s === "object") {
      return {
        totalDistance: Number(s.totalDistance) || 0,
        clears: Number(s.clears) || 0,
        deaths: Number(s.deaths) || 0,
        playCount: Number(s.playCount) || 0,
        abilities: s.abilities || { warp: 0, revive: 0, freeze: 0 },
        bestScore: Number(s.bestScore) || 0
      };
    }
  } catch (e) {}
  return { totalDistance: 0, clears: 0, deaths: 0, playCount: 0, abilities: { warp: 0, revive: 0, freeze: 0 }, bestScore: 0 };
}
function savePlayStats(s) {
  try { localStorage.setItem("drawRunPlayStats", JSON.stringify(s)); } catch (e) {}
}
function recordStat(type, value) {
  const s = loadPlayStats();
  if (type === "distance") s.totalDistance += Math.max(0, Number(value) || 0);
  else if (type === "clear") s.clears += 1;
  else if (type === "death") s.deaths += 1;
  else if (type === "play") s.playCount += 1;
  else if (type === "ability") {
    if (!s.abilities) s.abilities = { warp: 0, revive: 0, freeze: 0 };
    s.abilities[value] = (s.abilities[value] || 0) + 1;
  } else if (type === "best") {
    if (Number(value) > s.bestScore) s.bestScore = Number(value);
  }
  savePlayStats(s);
}

function saveScore(newScore) {
  if (currentMode !== "score") return;

  const now = new Date();
  const dateString = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let scores = JSON.parse(localStorage.getItem('drawRunScores')) || [];
  scores.push({ score: newScore, date: dateString });
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 5); 
  localStorage.setItem('drawRunScores', JSON.stringify(scores));

  const lastRecord = { score: newScore, date: dateString };
  localStorage.setItem('drawRunLastScore', JSON.stringify(lastRecord));

  try {
    const prevBest = Number(localStorage.getItem("drawRunBestScore")) || 0;
    if (newScore > prevBest) {
      localStorage.setItem("drawRunBestScore", String(newScore));
    }
  } catch (e) {}
}

function saveStageClear(modeKey) {
  const cleared = JSON.parse(localStorage.getItem('drawRunStageClears')) || {};
  cleared[modeKey] = true;
  localStorage.setItem('drawRunStageClears', JSON.stringify(cleared));
}

const grounds = [];
const walls = [];
const rings = [];   
const spikes = [];  
const warpPickups = []; 
const fakeFloors = []; 
const blinkPlatforms = []; 
let warpCount = 0;
let reviveCharges = 0;      // 一度復活
let reviveInvulnFrames = 0; // 復活直後の無敵
let freezeItemCount = 0;    // 旧:時間停止（非使用）
let freezeFrames = 0;
let freezeHoldX = 0;
let freezeHoldY = 0;
let invulnCharges = 0;      // 数秒無敵アイテム
let invulnActiveFrames = 0; // 無敵の残りフレーム
let lineExtendLevel = 0;    // 線の長さ強化 (0〜3)
const LINE_EXTEND_MAX = 3;
const ABILITIES_ENABLED = false; // 能力・強化要素オフ
const INVULN_DURATION_FRAMES = 180; // 約3秒

// ===== 演出強化 =====
let shakeX = 0, shakeY = 0, shakeMag = 0;
let stylePoints = 0, styleCombo = 0, styleComboTimer = 0, nearMissCooldown = 0;
let juiceParticles = [];
let smoothCameraX = 0;
let speedLines = 0;

function addShake(mag) { shakeMag = Math.max(shakeMag, mag); }
function spawnJuice(x, y, color, n) {
  for (let i = 0; i < (n || 8); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 4;
    juiceParticles.push({ x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:20+Math.random()*14, max:34, size:2+Math.random()*3, color:color||"#fff" });
  }
}
function updateJuice() {
  if (shakeMag > 0.05) {
    shakeX = (Math.random()-0.5)*shakeMag*2;
    shakeY = (Math.random()-0.5)*shakeMag*2;
    shakeMag *= 0.82;
  } else { shakeX = shakeY = shakeMag = 0; }
  if (styleComboTimer > 0) styleComboTimer--; else styleCombo = 0;
  if (nearMissCooldown > 0) nearMissCooldown--;
  if (speedLines > 0) speedLines--;
  for (let i = juiceParticles.length-1; i >= 0; i--) {
    const p = juiceParticles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life--;
    if (p.life <= 0) juiceParticles.splice(i, 1);
  }
}
function drawJuice() {
  for (const p of juiceParticles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - cameraX + (shakeX||0), p.y + (shakeY||0), p.size, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (speedLines > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255," + (0.07 + 0.1 * (speedLines/20)) + ")";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const yy = (i * 90 + (Date.now()/8) % 90) % canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(50 + (i%3)*18, yy+5);
      ctx.stroke();
    }
    ctx.restore();
  }
}
function checkNearMissJuice() {
  if (nearMissCooldown > 0 || !player) return;
  const px = player.position.x, py = player.position.y;
  let hit = false;
  for (const w of walls) {
    const dx = px - w.position.x, dy = py - w.position.y;
    const d = Math.sqrt(dx*dx+dy*dy);
    if (d > 30 && d < 58) { hit = true; break; }
  }
  if (!hit) {
    for (const s of spikes) {
      const dx = px - s.position.x, dy = py - s.position.y;
      const d = Math.sqrt(dx*dx+dy*dy);
      if (d > 22 && d < 50) { hit = true; break; }
    }
  }
  if (hit) {
    nearMissCooldown = 45;
    styleCombo = Math.min(20, styleCombo + 1);
    styleComboTimer = 120;
    stylePoints += 10 + styleCombo * 2;
    spawnJuice(px, py, "#ffe566", 6);
    addShake(2.2);
  }
}
const FREEZE_DURATION_FRAMES = 120; // 約2秒
let abilityChoiceOpen = false;
let abilityChoiceTriggeredStart = false;
let abilityMilestonesDone = {};
let isReviving = false;
let reviveHoldX = 200;
let isCountingDown = false;
let countdownTimerId = null;

let windState = "idle"; 
let windTimer = 0;
let windDir = -1; 
const WIND_WARNING_FRAMES = 70;
const WIND_ACTIVE_FRAMES = 100;
const WIND_COOLDOWN_MIN = 260;
const WIND_COOLDOWN_MAX = 400;
let windCooldownTarget = 300;
const WARP_MAX = 3;
const WARP_DISTANCE = 450; 

let lineBoostFrames = 0;
const LINE_BOOST_DURATION = 300; 
const LINE_BOOST_MAX_LEN = baseHoleSize * 2.2;
const LINE_BOOST_THICKNESS = 32;
const LINE_NORMAL_THICKNESS = 26;
const LINE_BOOST_LIFETIME = 2200; // 強化線が残る時間
const LINE_NORMAL_LIFETIME = 1100;  // 通常線が残る時間

let spikeState = "idle"; 
let spikeTimer = 0;
let pendingSpikeX = 0; 

let groundSpikeState = "idle"; 
let groundSpikeTimer = 0;
let groundSpikeX = 0;
let groundSpikeHeight = 0; 
const GS_WARNING_FRAMES = 50;  
const GS_POP_FRAMES = 40;
const GS_COOLDOWN_MIN = 280;
const GS_COOLDOWN_MAX = 420;
let gsCooldownTarget = 320;
let groundSpikeBody = null;

let slowMoFactor = 1;
const SPIKE_WARNING_FRAMES = 60;  
const SPIKE_FALL_FRAMES = 90;
const SPIKE_COOLDOWN_MIN = 240;
const SPIKE_COOLDOWN_MAX = 420;
let spikeCooldownTarget = 300;

let currentX = 0;
const segmentWidth = 400; 
let lastObstacleX = 0;

function resetWorldForMode() {
  // 前回の重力反転状態を必ず通常状態へ戻してから新しいステージを初期化。
  setGravityWorldFlipped(false);
  engine.world.gravity.y = normalGravityY;

  grounds.forEach(g => World.remove(world, g));
  walls.forEach(w => World.remove(world, w));
  spikes.forEach(s => World.remove(world, s));
  grounds.length = 0;
  walls.length = 0;
  spikes.length = 0;
  rings.length = 0;
  warpPickups.length = 0;
  fakeFloors.length = 0;
  blinkPlatforms.forEach(bp => { if (bp.body) World.remove(world, bp.body); });
  blinkPlatforms.length = 0;
  warpCount = 0;
  reviveCharges = 0;
  reviveInvulnFrames = 0;
  freezeItemCount = 0;
  freezeFrames = 0;
  invulnCharges = 0;
  invulnActiveFrames = 0;
  lineExtendLevel = 0;
  stylePoints = 0; styleCombo = 0; styleComboTimer = 0;
  juiceParticles = []; shakeMag = 0; speedLines = 0; smoothCameraX = 0;
  abilityChoiceOpen = false;
  abilityChoiceTriggeredStart = false;
  abilityMilestonesDone = {};
  isReviving = false;
  isCountingDown = false;
  windState = "idle";
  windTimer = 0;
  lineBoostFrames = 0;
  spikeState = "idle";
  spikeTimer = 0;
  pendingSpikeX = 0;
  groundSpikeState = "idle";
  groundSpikeTimer = 0;
  groundSpikeHeight = 0;
  slowMoFactor = 1;
  if (groundSpikeBody) {
    World.remove(world, groundSpikeBody);
    groundSpikeBody = null;
  }

  currentLines.forEach(l => World.remove(world, l));
  currentLines.length = 0;

  Body.setPosition(player, { x: 200, y: canvas.height / 2 });
  Body.setVelocity(player, { x: 0, y: 0 });

  currentX = 0;
  lastObstacleX = 0;
  cameraX = 0;
  score = 0;
  stoppedTime = 0;
  airborneFrames = 0;
  upperZoneFrames = 0;
  isTouchingGroundOrLine = false;
  gameOver = false;
  gameCleared = false;
  drawing = false;
  lastPoint = null;
  currentDrawLength = 0;
  lastReleaseTime = 0;

  laserState = "idle";
  laserTimer = 0;
  laserSafeLane = 1;
  gravityReverseState = "idle";
  activeGimmick = null;
  gravityWorldFlipped = false;
  engine.world.gravity.y = normalGravityY;
  const warnEl = document.getElementById("gravity-warning");
  if (warnEl) warnEl.classList.add("hidden");

  timeAccumulator = 0;
  lastFrameTime = performance.now();

  for (let i = 0; i < 15; i++) {
    generateSegment();
  }
}

function generateSegment() {
  if (!currentConfig) return;

  // 通常時は下、重力反転中は上を新しい地面として使う。
  const currentGroundY = gravityWorldFlipped ? 40 : canvas.height - 40;
  const groundHeight = 80;
  const cfg = currentConfig;

  if (!cfg.isInfinite) {
    const targetX = (cfg.targetScore * 100) + 200 + 1200; 
    if (currentX > targetX) {
      const ground = Bodies.rectangle(
        currentX + segmentWidth / 2,
        currentGroundY,
        segmentWidth,
        groundHeight,
        { isStatic: true, label: "ground" }
      );
      grounds.push(ground);
      World.add(world, ground);
      currentX += segmentWidth;
      return;
    }
  }

  if (currentX <= 1200) {
    const ground = Bodies.rectangle(
      currentX + segmentWidth / 2,
      currentGroundY,
      segmentWidth,
      groundHeight,
      { isStatic: true, label: "ground" }
    );
    grounds.push(ground);
    World.add(world, ground);
    currentX += segmentWidth;
    return;
  }

  const distanceSinceLastObstacle = currentX - lastObstacleX;
  const isSafeZoneOver = distanceSinceLastObstacle >= cfg.minSafeDistance;

  if (!isSafeZoneOver) {
    const ground = Bodies.rectangle(currentX + segmentWidth / 2, currentGroundY, segmentWidth, groundHeight, { isStatic: true, label: "ground" });
    grounds.push(ground);
    World.add(world, ground);
    currentX += segmentWidth;
    return;
  }

  const rand = Math.random();
  const boostRingChance = (cfg.ringEnabled && cfg.ringChance) ? cfg.ringChance : 0;
  const normalRingChance = (cfg.ringEnabled && cfg.normalRingChance) ? cfg.normalRingChance : 0;
  const fakeChance = (cfg.fakeFloorEnabled && cfg.fakeFloorChance) ? cfg.fakeFloorChance : 0;
  const groundEdgeY = gravityWorldFlipped
    ? currentGroundY + groundHeight / 2
    : currentGroundY - groundHeight / 2;

  function placeWarpItem(gx) {
    if (!cfg.warpItemEnabled) return;
    if (Math.random() > (cfg.warpItemChance || 0.35)) return;
    warpPickups.push({
      x: gx,
      y: gravityWorldFlipped
        ? 180 + Math.random() * 100
        : 420 + Math.random() * 100,
      r: 28,
      taken: false
    });
  }

  if (fakeChance > 0 && rand < fakeChance) {
    const fw = segmentWidth;
    fakeFloors.push({
      x: currentX + fw / 2,
      y: currentGroundY,
      w: fw,
      h: groundHeight
    });
    currentX += segmentWidth;
    lastObstacleX = currentX;

  } else if (boostRingChance > 0 && rand < fakeChance + boostRingChance) {
    const ground = Bodies.rectangle(currentX + segmentWidth / 2, currentGroundY, segmentWidth, groundHeight, { isStatic: true, label: "ground" });
    grounds.push(ground);
    World.add(world, ground);
    const ringX = currentX + segmentWidth / 2;
    const ringY = gravityWorldFlipped
      ? 180 + Math.random() * 120
      : 400 + Math.random() * 120;
    rings.push({ x: ringX, y: ringY, r: 48, used: false, type: "boost" });
    placeWarpItem(ringX);
    currentX += segmentWidth;
    lastObstacleX = currentX;

  } else if (normalRingChance > 0 && lineBoostFrames > 0 && rand < fakeChance + boostRingChance + normalRingChance) {
    const ground = Bodies.rectangle(currentX + segmentWidth / 2, currentGroundY, segmentWidth, groundHeight, { isStatic: true, label: "ground" });
    grounds.push(ground);
    World.add(world, ground);
    const ringX = currentX + segmentWidth / 2;
    const ringY = gravityWorldFlipped
      ? 180 + Math.random() * 120
      : 400 + Math.random() * 120;
    rings.push({ x: ringX, y: ringY, r: 48, used: false, type: "normal" });
    placeWarpItem(ringX);
    currentX += segmentWidth;
    lastObstacleX = currentX;

  } else if (rand < fakeChance + cfg.holeChance + boostRingChance + (lineBoostFrames > 0 ? normalRingChance : 0)) {
    const maxSafeHoleSize = maxDrawLength * cfg.maxHoleWidthFactor;
    const holeWidth = cfg.minHoleWidth + Math.random() * (maxSafeHoleSize - cfg.minHoleWidth);
    const leftWidth = 100;
    const leftGround = Bodies.rectangle(currentX + leftWidth / 2, currentGroundY, leftWidth, groundHeight, { isStatic: true, label: "ground" });
    grounds.push(leftGround);
    World.add(world, leftGround);
    currentX += leftWidth + holeWidth;
    const rightWidth = 150;
    const rightCenter = currentX + rightWidth / 2;
    const rightGround = Bodies.rectangle(rightCenter, currentGroundY, rightWidth, groundHeight, { isStatic: true, label: "ground" });
    grounds.push(rightGround);
    World.add(world, rightGround);
    placeWarpItem(rightCenter);
    currentX += rightWidth;
    lastObstacleX = currentX;

  } else {
    const ground = Bodies.rectangle(currentX + segmentWidth / 2, currentGroundY, segmentWidth, groundHeight, { isStatic: true, label: "ground" });
    grounds.push(ground);
    World.add(world, ground);
    const targetX = currentX + segmentWidth / 2;
    const maxWallH = Math.min(cfg.wallHeightMax, Math.floor(canvas.height * 0.25));
    const minWallH = Math.min(Math.max(cfg.wallHeightMin, 40), maxWallH);
    const randomWallHeight = minWallH + Math.random() * (maxWallH - minWallH);
    const currentWallY = gravityWorldFlipped
      ? groundEdgeY + randomWallHeight / 2
      : groundEdgeY - randomWallHeight / 2;
    const wall = Bodies.rectangle(targetX, currentWallY, 40, randomWallHeight, { isStatic: true, label: "wall" });
    walls.push(wall);
    World.add(world, wall);
    placeWarpItem(targetX + 70);
    currentX += segmentWidth;
    lastObstacleX = currentX;
  }

  if (cfg.blinkPlatformEnabled && Math.random() < (cfg.blinkPlatformChance || 0.25)) {
    const bx = currentX + 80;
    const by = gravityWorldFlipped
      ? currentGroundY + 120 + Math.random() * 100
      : currentGroundY - 120 - Math.random() * 100;
    const bw = 120 + Math.random() * 60;
    const bh = 22;
    const body = Bodies.rectangle(bx, by, bw, bh, { isStatic: true, label: "ground" });
    World.add(world, body);
    blinkPlatforms.push({
      body: body,
      x: bx, y: by, w: bw, h: bh,
      state: "solid", 
      timer: 0,
      solidFrames: 120 + Math.floor(Math.random() * 90),
      warningFrames: 50
    });
  }

  // 反転中の新しい地形は currentGroundY が上側になるため、
  // ここで既存オブジェクトを移動する必要はない。
}

let drawing = false;
let lastPoint = null;
const currentLines = [];
let currentDrawLength = 0;
const maxDrawTime = 3000;
let drawStartTime = 0;

function releaseLines() {
  if (!drawing) return;
  drawing = false;
  lastPoint = null;
  lastReleaseTime = Date.now();

  if (currentLines.length > 0) {
    const combinedLine = Body.create({
      parts: [...currentLines],
      isStatic: false, 
      friction: 1.2,
      frictionStatic: 1.5,
      restitution: 0,
      density: 0.003,
      label: "line"
    });

    currentLines.forEach((line) => {
      World.remove(world, line);
    });
    currentLines.length = 0;

    if (lineBoostFrames > 0) combinedLine._boosted = true;
    currentLines.push(combinedLine);
    World.add(world, combinedLine);

    const life = (lineBoostFrames > 0) ? LINE_BOOST_LIFETIME : LINE_NORMAL_LIFETIME;
    setTimeout(() => {
      World.remove(world, combinedLine);
      const index = currentLines.indexOf(combinedLine);
      if (index !== -1) {
        currentLines.splice(index, 1);
      }
    }, life);
  }
}

function getCanvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function startDrawing(clientX, clientY) {
  if (!gameStarted) return;
  if (gameOver || gameCleared) return;

  const timeSinceLastRelease = Date.now() - lastReleaseTime;
  if (timeSinceLastRelease < cooldownDuration) return; 

  const pt = getCanvasPoint(clientX, clientY);

  drawing = true;
  currentDrawLength = 0;
  drawStartTime = Date.now();
  lastPoint = { x: pt.x + cameraX, y: pt.y };
}

function moveDrawing(clientX, clientY) {
  if (!drawing) return;

  const elapsedTime = Date.now() - drawStartTime;
  if (elapsedTime >= getEffectiveMaxDrawTime()) {
    releaseLines();
    return;
  }

  const pt = getCanvasPoint(clientX, clientY);
  const currentPoint = { x: pt.x + cameraX, y: pt.y };
  const dx = currentPoint.x - lastPoint.x;
  const dy = currentPoint.y - lastPoint.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 1.5) return;

  const maxLen = lineBoostFrames > 0
    ? LINE_BOOST_MAX_LEN * (1 + 0.2 * Math.min(LINE_EXTEND_MAX, lineExtendLevel || 0))
    : getEffectiveMaxDrawLength();
  if (currentDrawLength + length > maxLen) return;

  const thickness = lineBoostFrames > 0 ? LINE_BOOST_THICKNESS : LINE_NORMAL_THICKNESS;
  const boosted = lineBoostFrames > 0;

  const stepLen = 4;
  const steps = Math.max(1, Math.ceil(length / stepLen));
  let fromX = lastPoint.x;
  let fromY = lastPoint.y;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const toX = lastPoint.x + dx * t;
    const toY = lastPoint.y + dy * t;
    const segDx = toX - fromX;
    const segDy = toY - fromY;
    const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
    if (segLen < 1) continue;
    if (currentDrawLength + segLen > maxLen) break;
    currentDrawLength += segLen;

    const angle = Math.atan2(segDy, segDx);
    const line = Bodies.rectangle(
      (fromX + toX) / 2,
      (fromY + toY) / 2,
      segLen,
      thickness,
      { isStatic: true, angle: angle, friction: 1.5, density: 0.004, frictionStatic: 2.0, label: "line" }
    );
    if (boosted) line._boosted = true;
    currentLines.push(line);
    World.add(world, line);
    fromX = toX;
    fromY = toY;
  }

  lastPoint = currentPoint;
}


function getStageDifficultyStars(modeKey) {
  const c = MODE_CONFIG[modeKey];
  if (!c) return 1;
  if (modeKey === "score") return 5;
  // 1〜5
  const v = (c.mainStage - 1) + Math.ceil(c.subStage * 0.7);
  return Math.max(1, Math.min(5, v));
}
function getNextStageKey(modeKey) {
  const idx = STAGE_ORDER.indexOf(modeKey);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}
function getPrevStageKey(modeKey) {
  const idx = STAGE_ORDER.indexOf(modeKey);
  if (idx <= 0) return null;
  return STAGE_ORDER[idx - 1];
}
function goToStageKey(modeKey) {
  if (!modeKey || !MODE_CONFIG[modeKey]) return;
  if (typeof isStageUnlocked === "function" && !isStageUnlocked(modeKey)) return;
  currentMode = modeKey;
  currentConfig = MODE_CONFIG[modeKey];
  gameOver = false;
  gameCleared = false;
  isReviving = false;
  abilityChoiceOpen = false;
  freezeFrames = 0;
  gameStarted = false;
  hideCountdownUI();
  clearFadeOverlay();
  startCountdownAndGame();
}



const SURVEY_URL = "https://docs.google.com/forms/d/e/1FAIpQLSesk-IyggxuCbUH_54STbgYozLTFdK__kJhHk88U_pZ952nPw/viewform?usp=publish-editor";
function showSurveyNudge() {
  let el = document.getElementById("survey-nudge");
  if (!el) {
    el = document.createElement("div");
    el.id = "survey-nudge";
    el.innerHTML =
      '<a class="survey-nudge-link" href="' + SURVEY_URL + '" target="_blank" rel="noopener noreferrer">' +
        '<img class="survey-nudge-img" alt="アンケート回答はこちら">' +
        '<span class="survey-nudge-text">📝 アンケート回答はこちら</span>' +
      '</a>';
    const container = document.getElementById("game-container") || document.body;
    container.appendChild(el);
    const img = el.querySelector(".survey-nudge-img");
    if (img) {
      const names = ["btn-survey.png", "survey.png", "btn_survey.png"];
      const list = [];
      names.forEach((n) => {
        if (typeof assetDirCandidates === "function") {
          assetDirCandidates(n).forEach((u) => list.push(u));
        } else {
          list.push(n, "UI/" + n, "ui/" + n);
        }
      });
      let i = 0;
      const tryNext = () => {
        if (i >= list.length) {
          img.style.display = "none";
          return;
        }
        const url = list[i++];
        const probe = new Image();
        probe.onload = () => {
          img.src = url;
          img.style.display = "block";
          el.classList.add("has-img");
        };
        probe.onerror = tryNext;
        probe.src = url;
      };
      tryNext();
    }
  }
  el.classList.add("visible");
}
function hideSurveyNudge() {
  const el = document.getElementById("survey-nudge");
  if (el) el.classList.remove("visible");
}

function hideResultMenu() {
  const menu = document.getElementById("result-menu");
  if (menu) menu.classList.remove("visible");
}
function showResultMenu() {
  const menu = document.getElementById("result-menu");
  if (!menu) return;
  const nextBtn = menu.querySelector('[data-action="next"]');
  const prevBtn = menu.querySelector('[data-action="prev"]');
  const isStage = currentMode && currentMode.startsWith("stage");
  if (nextBtn) {
    const nextKey = isStage ? getNextStageKey(currentMode) : null;
    const show = !!(nextKey && isStageUnlocked(nextKey));
    nextBtn.classList.toggle("hidden", !show);
  }
  if (prevBtn) {
    const prevKey = isStage ? getPrevStageKey(currentMode) : null;
    prevBtn.classList.toggle("hidden", !prevKey);
  }
  menu.classList.add("visible");
}
function initResultMenuUI() {
  const menu = document.getElementById("result-menu");
  if (!menu || menu.dataset.bound) return;
  menu.dataset.bound = "1";
  menu.addEventListener("click", (e) => {
    const btn = e.target.closest(".result-btn");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    try { playButtonSfx(); } catch (err) {}
    if (action === "retry") {
      hideResultMenu();
      restartSameStage();
    } else if (action === "next") {
      const nextKey = getNextStageKey(currentMode);
      if (nextKey) {
        hideResultMenu();
        goToStageKey(nextKey);
      }
    } else if (action === "prev") {
      const prevKey = getPrevStageKey(currentMode);
      if (prevKey) {
        hideResultMenu();
        goToStageKey(prevKey);
      }
    } else if (action === "title") {
      try { playBGM.pause(); } catch (err) {}
      location.reload();
    }
  });
}

function restartSameStage() {
  hideResultMenu();
  hideSurveyNudge();
  try { playBGM.pause(); } catch (e) {}
  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }
  gameOver = false;
  gameCleared = false;
  isReviving = false;
  abilityChoiceOpen = false;
  isCountingDown = false;
  freezeFrames = 0;
  gameStarted = false;
  hideCountdownUI();
  clearFadeOverlay();
  // currentMode / currentConfig はそのまま
  if (!currentConfig) {
    location.reload();
    return;
  }
  startCountdownAndGame();
}

function handleScreenClick(clientX, clientY) {
  // 結果メニューは HTML ボタンで処理
  if (gameOver || gameCleared) return true;
  return false;
}

canvas.addEventListener("mousedown", (e) => {
  if (handleScreenClick(e.clientX, e.clientY)) return;
  if (gameOver || gameCleared) return;
  startDrawing(e.clientX, e.clientY);
});
canvas.addEventListener("mousemove", (e) => moveDrawing(e.clientX, e.clientY));
canvas.addEventListener("mouseup", () => releaseLines());

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  if (handleScreenClick(touch.clientX, touch.clientY)) return;
  if (gameOver || gameCleared) return;
  startDrawing(touch.clientX, touch.clientY);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  moveDrawing(touch.clientX, touch.clientY);
});
canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  releaseLines();
});

// --- 衝突判定 ---
Matter.Events.on(engine, "collisionStart", (event) => {
  event.pairs.forEach((pair) => {
    const isLineA = pair.bodyA.label === "line";
    const isLineB = pair.bodyB.label === "line";
    const isStaticEnvA = pair.bodyA.label === "ground" || pair.bodyA.label === "wall";
    const isStaticEnvB = pair.bodyB.label === "ground" || pair.bodyB.label === "wall";

    if ((isLineA && isStaticEnvB) || (isLineB && isStaticEnvA)) {
      pair.isActive = false;
      return;
    }

    walls.forEach((wall) => {
      if ((pair.bodyA === player && pair.bodyB === wall) || (pair.bodyB === player && pair.bodyA === wall)) {
        if (!gameOver && !gameCleared) triggerGameOver();
      }
    });

    const labels = [pair.bodyA.label, pair.bodyB.label];
    if (labels.includes("spike")) {
      const spikeBody = pair.bodyA.label === "spike" ? pair.bodyA : pair.bodyB;
      const other = spikeBody === pair.bodyA ? pair.bodyB : pair.bodyA;
      // 線に当たったら消滅
      if (isLineBody(other)) {
        destroyFallingSpike(spikeBody);
        return;
      }
      if (other === player || other.label === "player") {
        if (!gameOver && !gameCleared) triggerGameOver();
      }
    }
  });
});

let isTouchingBoostLine = false;
let isTouchingLine = false;

Matter.Events.on(engine, "collisionActive", (event) => {
  let touchingSurface = false;
  let touchingBoost = false;
  let touchingLine = false;

  event.pairs.forEach((pair) => {
    if (pair.isActive) {
      const isPlayerA = pair.bodyA === player;
      const isPlayerB = pair.bodyB === player;

      if (isPlayerA || isPlayerB) {
        const other = isPlayerA ? pair.bodyB : pair.bodyA;
        const otherLabel = other.label;
        const otherParent = other.parent;
        const otherParentLabel = otherParent ? otherParent.label : "";

        if (
          otherLabel === "ground" || 
          otherLabel === "line" || 
          otherParentLabel === "line"
        ) {
          touchingSurface = true;
        }
        if (otherLabel === "line" || otherParentLabel === "line") {
          touchingLine = true;
          if (other._boosted || (otherParent && otherParent._boosted)) {
            touchingBoost = true;
          }
          if (other.parts) {
            for (let i = 0; i < other.parts.length; i++) {
              if (other.parts[i]._boosted) touchingBoost = true;
            }
          }
        }
      }
    }
  });

  isTouchingGroundOrLine = touchingSurface;
  isTouchingBoostLine = touchingBoost;
  isTouchingLine = touchingLine;
});



// ===== クリア／失敗演出 =====
let resultFx = [];
function spawnResultFx(isClear) {
  resultFx = [];
  const colors = isClear
    ? ["#33ff99", "#ffe566", "#7ee0ff", "#ffffff", "#ff9fd0"]
    : ["#ff5555", "#ff8844", "#aaaaaa", "#ff3333"];
  for (let i = 0; i < 48; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 2 + Math.random() * 6;
    resultFx.push({
      x: canvas.width / 2,
      y: canvas.height / 2 - 20,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 2,
      life: 50 + Math.floor(Math.random() * 30),
      color: colors[i % colors.length],
      size: 3 + Math.random() * 5
    });
  }
}
function updateAndDrawResultFx() {
  if (!resultFx.length) return;
  for (let i = resultFx.length - 1; i >= 0; i--) {
    const p = resultFx[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life--;
    if (p.life <= 0) {
      resultFx.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = Math.min(1, p.life / 30);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function isNightSkyStage() {
  return currentConfig && currentConfig.mainStage === 3;
}
function canUseAbilityChoice() {
  if (!ABILITIES_ENABLED) return false;
  if (!currentConfig) return false;
  if (currentMode === "score") return true;
  return currentConfig.mainStage >= 3;
}

function updateInvulnButtonUI() {
  const btn = document.getElementById("invuln-button");
  const countEl = document.getElementById("invuln-count");
  if (countEl) countEl.textContent = String(invulnCharges);
  if (btn) {
    btn.classList.toggle("disabled", invulnCharges <= 0 && invulnActiveFrames <= 0);
    const show = gameStarted && !gameOver && !gameCleared && !abilityChoiceOpen;
    btn.style.display = (ABILITIES_ENABLED && show && (invulnCharges > 0 || invulnActiveFrames > 0)) ? "flex" : "none";
    if (invulnActiveFrames > 0) {
      btn.style.borderColor = "rgba(255, 220, 80, 0.95)";
      btn.style.boxShadow = "0 0 16px rgba(255, 200, 60, 0.55)";
    } else {
      btn.style.borderColor = "rgba(255, 180, 60, 0.85)";
      btn.style.boxShadow = "0 0 12px rgba(255, 160, 40, 0.35)";
    }
  }
}

function useInvulnItem() {
  if (!ABILITIES_ENABLED) return;
  if (!gameStarted || gameOver || gameCleared || abilityChoiceOpen || isReviving) return;
  if (invulnActiveFrames > 0) return;
  if (invulnCharges <= 0) return;
  invulnCharges--;
  invulnActiveFrames = INVULN_DURATION_FRAMES;
  updateInvulnButtonUI();
  try { addShake(3); spawnJuice(player.position.x, player.position.y, "#ffd24d", 14); } catch (e) {}
  try { playButtonSfx(); } catch (e) {}
}


function applyAbilityChoice(kind) {
  if (!ABILITIES_ENABLED) return;
  if (kind === "warp") {
    warpCount = Math.min(WARP_MAX, warpCount + 2);
    updateWarpButtonUI();
  } else if (kind === "revive") {
    reviveCharges += 1;
  } else if (kind === "invuln") {
    invulnCharges += 1;
    updateInvulnButtonUI();
  } else if (kind === "line_extend") {
    lineExtendLevel = Math.min(LINE_EXTEND_MAX, (lineExtendLevel || 0) + 1);
  }
  try { recordStat("ability", kind); } catch (e) {}
}

function closeAbilityChoice() {
  abilityChoiceOpen = false;
  const overlay = document.getElementById("ability-choice-overlay");
  if (overlay) {
    overlay.classList.remove("visible");
    if (!ABILITIES_ENABLED) overlay.style.display = "none";
  }
  updateWarpButtonUI();
  updateInvulnButtonUI();
}

const ABILITY_META = {
  warp: { name: "🚀 ワープアイテム ×2", desc: "ワープを2個入手（最大3まで）" },
  revive: { name: "💖 一度復活", desc: "次に死んだとき、1回だけその場で復活" },
  invuln: { name: "🛡 数秒間無敵", desc: "使ったとき、数秒間ダメージを受けない" },
  line_extend: { name: "✏️ 線が長くなる", desc: "描ける線の長さがアップ（最大3回まで）" }
};

function pickAbilityOffer() {
  const pool = ["warp", "revive", "invuln"];
  if ((lineExtendLevel || 0) < LINE_EXTEND_MAX) pool.push("line_extend");
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  return pool.slice(0, 3);
}

function openAbilityChoice(reason) {
  if (!ABILITIES_ENABLED) return;
  if (!canUseAbilityChoice() || gameOver || gameCleared) return;
  if (abilityChoiceOpen) return;
  abilityChoiceOpen = true;
  try { releaseLines(); } catch (e) {}
  const overlay = document.getElementById("ability-choice-overlay");
  const sub = document.getElementById("ability-choice-sub");
  if (sub) {
    if (reason === "start") sub.textContent = "スタート！ 能力を1つ選んでください";
    else if (typeof reason === "number") sub.textContent = reason + "m到達！ 能力を1つ選んでください";
    else sub.textContent = "能力を1つ選んでください";
  }
  // 3つの選択肢を更新（線延長は最大3回まで）
  const offer = pickAbilityOffer();
  const btns = overlay ? overlay.querySelectorAll(".ability-opt") : [];
  offer.forEach((kind, i) => {
    const btn = btns[i];
    if (!btn) return;
    btn.setAttribute("data-ability", kind);
    const meta = ABILITY_META[kind] || { name: kind, desc: "" };
    const nameEl = btn.querySelector(".ability-opt-name");
    const descEl = btn.querySelector(".ability-opt-desc");
    if (nameEl) {
      if (kind === "line_extend") {
        nameEl.textContent = meta.name + " (" + ((lineExtendLevel || 0) + 1) + "/" + LINE_EXTEND_MAX + ")";
      } else if (kind === "revive") {
        nameEl.textContent = meta.name + (reviveCharges > 0 ? " 所持" + reviveCharges : "");
      } else {
        nameEl.textContent = meta.name;
      }
    }
    if (descEl) descEl.textContent = meta.desc;
    btn.style.display = "";
  });
  // 余ったボタンは隠す
  for (let i = offer.length; i < btns.length; i++) btns[i].style.display = "none";

  if (overlay) overlay.classList.add("visible");
  updateWarpButtonUI();
  updateInvulnButtonUI();
}

function checkAbilityChoiceTriggers() {
  if (!canUseAbilityChoice() || gameOver || gameCleared || abilityChoiceOpen) return;
  if (!gameStarted || isCountingDown || isReviving) return;

  // 開始直後
  if (!abilityChoiceTriggeredStart && score <= 2) {
    abilityChoiceTriggeredStart = true;
    abilityMilestonesDone[0] = true;
    openAbilityChoice("start");
    return;
  }
  // 100mごと
  if (score >= 100) {
    const mile = Math.floor(score / 100) * 100;
    if (mile >= 100 && !abilityMilestonesDone[mile]) {
      abilityMilestonesDone[mile] = true;
      openAbilityChoice(mile);
    }
  }
}

function initAbilityChoiceUI() {
  const overlay = document.getElementById("ability-choice-overlay");
  if (!ABILITIES_ENABLED) {
    if (overlay) { overlay.classList.remove("visible"); overlay.style.display = "none"; }
    const inv = document.getElementById("invuln-button");
    if (inv) inv.style.display = "none";
    return;
  }
  if (overlay && !overlay.dataset.bound) {
    overlay.dataset.bound = "1";
    overlay.addEventListener("click", (e) => {
      const btn = e.target.closest(".ability-opt");
      if (!btn || !abilityChoiceOpen) return;
      const kind = btn.getAttribute("data-ability");
      if (!kind) return;
      try { playButtonSfx(); } catch (err) {}
      applyAbilityChoice(kind);
      closeAbilityChoice();
    });
  }
  const invulnBtn = document.getElementById("invuln-button");
  if (invulnBtn && !invulnBtn.dataset.bound) {
    invulnBtn.dataset.bound = "1";
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      useInvulnItem();
    };
    invulnBtn.addEventListener("click", handler);
    invulnBtn.addEventListener("touchstart", handler, { passive: false });
  }
}

function triggerGameOver() {
  if (gameOver || gameCleared) return;
  if (isReviving || isCountingDown) return; // 復活演出中の連続死亡を防ぐ
  if (freezeFrames > 0) return; // 時間停止中は無敵
  if (window.DRAW_RUN && window.DRAW_RUN.invincible) return;
  if (reviveInvulnFrames > 0) return;
  if (invulnActiveFrames > 0) return;
  // 一度復活
  if (reviveCharges > 0) {
    reviveCharges--;
    try { playDeathSfx(); } catch (e) {}
    startReviveSequence();
    return;
  }
  gameOver = true;
  try { addShake(14); spawnJuice(player.position.x, player.position.y, "#ff4466", 22); } catch (e) {}
  saveScore(score);
  try {
    recordStat("death");
    spawnResultFx(false);
  } catch (e) {}
  try { showResultMenu(); } catch (e) {}

  playBGM.pause();
  playDeathSfx();
}

function triggerGameClear() {
  if (gameOver || gameCleared) return;
  gameCleared = true;
  try { addShake(8); spawnJuice(player.position.x, player.position.y, "#33ff99", 26); stylePoints += 100; } catch (e) {}

  if (currentMode && currentMode.startsWith("stage")) {
    saveStageClear(currentMode);
  }
  try {
    recordStat("clear");
    recordStat("distance", score);
    spawnResultFx(true);
  } catch (e) {}
  try { showResultMenu(); } catch (e) {}
  // ステージクリア時：邪魔にならないアンケート案内
  if (currentMode && currentMode.startsWith("stage")) {
    try { showSurveyNudge(); } catch (e) {}
  }

  playBGM.pause();
  playClearSfx();
}

function isGravityVisualFlipped() {
  return gravityReverseState === "active";
}

function drawGravityReverseOverlay() {
  if (gravityReverseState !== "warning" && gravityReverseState !== "active") return;

  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 90);
  const alpha = gravityReverseState === "active"
    ? 0.12 + pulse * 0.05
    : 0.06 + pulse * 0.03;

  ctx.save();
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, `rgba(150, 90, 255, ${alpha * 0.7})`);
  gradient.addColorStop(0.5, `rgba(90, 170, 255, ${alpha})`);
  gradient.addColorStop(1, `rgba(150, 90, 255, ${alpha * 0.7})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (gravityReverseState === "active") {
    ctx.strokeStyle = `rgba(190, 120, 255, ${0.28 + pulse * 0.12})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawBody(body, color) {
  ctx.save();
  ctx.translate(body.position.x - cameraX, body.position.y);

  if (body !== player && !body.isSensor) {
    ctx.rotate(body.angle);
  }

  if (body.circleRadius) {
    if (body === player) {
      const size = 50;
      const currentSkinImg = playerImages[currentSkinIndex];
      
      if (currentSkinImg && currentSkinImg.naturalWidth > 0) {
        const imgWidth = currentSkinImg.width;
        const imgHeight = currentSkinImg.height;
        const drawHeight = size * (imgHeight / imgWidth);

        ctx.save();
        if (isGravityVisualFlipped()) {
          ctx.scale(1, -1);
        }

        // 歩行・空中の見た目
        const grounded = !!isTouchingGroundOrLine;
        const spd = Math.abs(player.velocity.x) + Math.abs(player.velocity.y) * 0.3;
        const phase = (typeof score === "number" ? score : 0) * 0.55 + (player.position.x || 0) * 0.08;
        let bobY = 0;
        let tilt = 0;
        let scaleX = 1;
        let scaleY = 1;
        if (grounded && gameStarted && !gameOver && !isReviving) {
          // 歩く：上下に小さく、少し前後に傾ける
          bobY = Math.sin(phase * 2.2) * 3.2;
          tilt = Math.sin(phase * 2.2) * 0.10;
          scaleX = 1 + Math.sin(phase * 2.2) * 0.04;
          scaleY = 1 - Math.sin(phase * 2.2) * 0.04;
        } else if (gameStarted && !gameOver) {
          // 空中：少し前傾＋落下で伸び
          tilt = 0.12;
          const vy = player.velocity.y || 0;
          scaleY = 1 + Math.min(0.12, Math.abs(vy) * 0.01);
          scaleX = 1 / scaleY;
          bobY = Math.sin(Date.now() / 120) * 1.2;
        }
        ctx.translate(0, bobY);
        ctx.rotate(tilt);
        ctx.scale(scaleX, scaleY);

        // 細い半透明の縁取り
        const ox = [-1, 1, 0, 0];
        const oy = [0, 0, -1, 1];
        ctx.globalAlpha = 0.35;
        for (let i = 0; i < ox.length; i++) {
          ctx.drawImage(
            currentSkinImg,
            -size / 2 + ox[i],
            -drawHeight / 2 + oy[i],
            size,
            drawHeight
          );
        }
        ctx.globalAlpha = 1;
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.drawImage(
          currentSkinImg,
          -size / 2,
          -drawHeight / 2,
          size,
          drawHeight
        );
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, body.circleRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, body.circleRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else {
    if (body.parts && body.parts.length > 1) {
      for (let i = 1; i < body.parts.length; i++) {
        const part = body.parts[i];
        ctx.save();
        ctx.translate(part.position.x - body.position.x, part.position.y - body.position.y);
        ctx.rotate(part.angle - body.angle);

        const pWidth = part.bounds.max.x - part.bounds.min.x;
        const pHeight = part.bounds.max.y - part.bounds.min.y;

        ctx.fillStyle = color;
        ctx.fillRect(-pWidth / 2, -pHeight / 2, pWidth, pHeight);

        ctx.restore();
      }
    } else {
      const width = body.bounds.max.x - body.bounds.min.x;
      const height = body.bounds.max.y - body.bounds.min.y;

      if (grounds.includes(body)) {
        if (isGravityVisualFlipped()) {
          ctx.scale(1, -1);
        }
        ctx.drawImage(groundImage, -width / 2, -height / 2, width, height);
      } else if (walls.includes(body) || body.label === "wall") {
        if (isGravityVisualFlipped()) {
          ctx.scale(1, -1);
        }
        const x = -width / 2, y = -height / 2;
        if (typeof wallImage !== "undefined" && wallImage.complete && wallImage.naturalWidth > 0) {
          ctx.drawImage(wallImage, x, y, width, height);
        } else {
          // フォールバック：ポップな壁
          const g = ctx.createLinearGradient(0, y, 0, y + height);
          g.addColorStop(0, "#7ec8ff");
          g.addColorStop(1, "#3b82f6");
          ctx.fillStyle = g;
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, width, height, 8); ctx.fill(); }
          else ctx.fillRect(x, y, width, height);
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, width, height, 8); ctx.stroke(); }
        }
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(-width / 2, -height / 2, width, height);
      }
    }
  }
  ctx.restore();
}

function getActiveBackground() {
  if (!currentConfig) return bgAozora;

  if (currentConfig.bgFixed) {
    switch (currentConfig.bgFixed) {
      case "aozora":  return bgAozora;
      case "yuugure": return bgYuugure;
      case "yozora":  return bgYozora;
      case "cyber":   return bgCyber;
      case "volcano":
        if (bgVolcano.complete && bgVolcano.naturalWidth > 0) return bgVolcano;
        return { procedural: "volcano" };
      case "void":    return { procedural: "void" };
      default:        return bgAozora;
    }
  }

  if (score >= 300) return bgCyber;
  if (score >= 200) return bgYozora;
  if (score >= 100) return bgYuugure;
  return bgAozora;
}

const FIXED_DT_MS = 1000 / 60;   
const FIXED_DT_SEC = 1 / 60;
const MAX_FRAME_MS = 80;         
let lastFrameTime = performance.now();
let timeAccumulator = 0;

function updateRings() {
  if (lineBoostFrames > 0) lineBoostFrames--;

  for (const ring of rings) {
    if (ring.used) continue;
    if (ring.type === "normal" && lineBoostFrames <= 0) continue;
    const dx = player.position.x - ring.x;
    const dy = player.position.y - ring.y;
    // リングは触判定のみ（押し出し・跳ねなし）
    if (dx * dx + dy * dy < (ring.r + 18) * (ring.r + 18)) {
      ring.used = true;
      if (ring.type === "normal") {
        lineBoostFrames = 0;
      } else {
        lineBoostFrames = LINE_BOOST_DURATION;
        const nx = player.position.x + 350 + Math.random() * 200;
        const ny = 400 + Math.random() * 120;
        rings.push({ x: nx, y: ny, r: 48, used: false, type: "normal" });
      }
      try { spawnJuice(ring.x, ring.y, ring.type === "normal" ? "#ffcc44" : "#00e5ff", 8); } catch (e) {}
      // 速度は変えない（当たり判定で弾かれない）
    }
  }
}

function isLineBody(body) {
  if (!body) return false;
  if (body.label === "line") return true;
  if (body.parent && body.parent.label === "line") return true;
  return false;
}

function destroyFallingSpike(spikeBody) {
  if (!spikeBody) return;
  try { World.remove(world, spikeBody); } catch (e) {}
  const idx = spikes.indexOf(spikeBody);
  if (idx >= 0) spikes.splice(idx, 1);
  try {
    spawnJuice(spikeBody.position.x, spikeBody.position.y, "#ff8866", 10);
  } catch (e) {}
}

// 落下予定位置に壁・穴など他障害がないか
function canSpawnFallingSpikeAt(sx) {
  const range = 220;
  for (let i = 0; i < walls.length; i++) {
    if (Math.abs(walls[i].position.x - sx) < range) return false;
  }
  // 地面があるか（穴の上には落とさない）
  let hasGround = false;
  for (let i = 0; i < grounds.length; i++) {
    const g = grounds[i];
    const half = (g.bounds.max.x - g.bounds.min.x) / 2;
    if (sx >= g.position.x - half - 20 && sx <= g.position.x + half + 20) {
      hasGround = true;
      break;
    }
  }
  if (!hasGround) return false;
  // 他の落下トゲが近い
  for (let i = 0; i < spikes.length; i++) {
    if (Math.abs(spikes[i].position.x - sx) < range * 0.8) return false;
  }
  return true;
}

function spawnFallingSpikes() {
  const fallTimeSec = 0.85;
  const sx = player.position.x + (playerSpeed || 4) * 60 * fallTimeSec;
  pendingSpikeX = sx;
  if (!canSpawnFallingSpikeAt(sx)) {
    // 障害物があるので今回はスキップ
    spikeState = "cooldown";
    spikeTimer = 0;
    spikeCooldownTarget = SPIKE_COOLDOWN_MIN;
    try { endGimmick("spike"); } catch (e) {}
    return;
  }
  const sy = isGravityVisualFlipped() ? canvas.height + 20 : -20;
  const spikeW = 78; // 横幅を大きめに
  const spikeH = 64;
  const spike = Bodies.rectangle(sx, sy, spikeW, spikeH, {
    isStatic: false,
    friction: 0.01,
    restitution: 0,
    density: 0.008,
    label: "spike",
    inertia: Infinity
  });
  Body.setVelocity(spike, {
    x: playerSpeed * 0.3,
    y: isGravityVisualFlipped() ? -14 : 14
  });
  spikes.push(spike);
  World.add(world, spike);
}

function updateSpikeGimmick() {
  if (!currentConfig || !currentConfig.spikeEnabled) {
    if (spikeState !== "idle") {
      endGimmick("spike");
      spikeState = "idle";
    }
    return;
  }
  const startAt = currentConfig.spikeStartScore != null ? currentConfig.spikeStartScore : 100;
  if (score < startAt) return;

  spikeTimer++;

  if (spikeState === "idle") {
    const previewX = player.position.x + (playerSpeed || 4) * 60 * 0.85;
    if (!canSpawnFallingSpikeAt(previewX)) return; // 他障害物があるときは発生しない
    if (tryStartGimmick("spike")) {
      spikeState = "warning";
      spikeTimer = 0;
      pendingSpikeX = previewX;
    }
  } else if (spikeState === "warning") {
    pendingSpikeX = player.position.x + (playerSpeed || 4) * 60 * 0.85;
    if (spikeTimer >= SPIKE_WARNING_FRAMES) {
      if (!canSpawnFallingSpikeAt(pendingSpikeX)) {
        spikeState = "cooldown";
        spikeTimer = 0;
        spikeCooldownTarget = SPIKE_COOLDOWN_MIN;
        try { endGimmick("spike"); } catch (e) {}
      } else {
        spikeState = "falling";
        spikeTimer = 0;
        spawnFallingSpikes();
      }
    }
  } else if (spikeState === "falling") {
    if (spikeTimer >= SPIKE_FALL_FRAMES) {
      spikeState = "cooldown";
      spikeTimer = 0;
      spikeCooldownTarget = SPIKE_COOLDOWN_MIN + Math.floor(Math.random() * (SPIKE_COOLDOWN_MAX - SPIKE_COOLDOWN_MIN + 1));
    }
  } else if (spikeState === "cooldown") {
    if (spikeTimer >= spikeCooldownTarget) {
      spikeState = "idle";
      spikeTimer = 0;
      endGimmick("spike");
    }
  }
}

function drawRings() {
  const pulse = 0.85 + 0.15 * Math.sin(Date.now() / 150);
  rings.forEach(ring => {
    const sx = ring.x - cameraX;
    if (sx < -80 || sx > canvas.width + 80) return;
    const isNormal = ring.type === "normal";
    if (isNormal && lineBoostFrames <= 0 && !ring.used) return;
    const size = ring.r * 2.2;
    const img = isNormal ? normalRingImage : ringImage;
    ctx.save();
    ctx.translate(sx, ring.y);
    if (ring.used) {
      ctx.globalAlpha = 0.35;
    } else {
      ctx.globalAlpha = pulse;
      ctx.shadowColor = isNormal ? "rgba(255, 200, 80, 0.7)" : "rgba(0, 220, 255, 0.7)";
      ctx.shadowBlur = 14;
    }
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = isNormal ? "#ffcc44" : "#00dcff";
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    ctx.restore();
  });

  if (lineBoostFrames > 0) {
    ctx.save();
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#00e5ff";
    ctx.textAlign = "center";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 8;
    ctx.fillText("INK BOOST!", canvas.width / 2, 85);
    ctx.restore();
  }
}

function drawSpikes() {
  const drawW = 86;
  const drawH = 72;

  spikes.forEach(sp => {
    const sx = sp.position.x - cameraX;
    const sy = sp.position.y;
    if (sx < -60 || sx > canvas.width + 60) return;
    ctx.save();
    ctx.translate(sx, sy);
    if (spikeImage.complete && spikeImage.naturalWidth > 0) {
      if (isGravityVisualFlipped()) {
        ctx.scale(1, -1);
      }
      ctx.drawImage(spikeImage, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, drawH / 2);
      ctx.lineTo(-drawW / 2, -drawH / 2);
      ctx.lineTo(drawW / 2, -drawH / 2);
      ctx.closePath();
      ctx.fillStyle = "#c0392b";
      ctx.fill();
    }
    ctx.restore();
  });

  if (spikeState === "warning") {
    const flash = Math.sin(Date.now() / 80) > 0;
    const wx = pendingSpikeX - cameraX;
    ctx.save();
    if (flash && wx > -40 && wx < canvas.width + 40) {
      ctx.fillStyle = "rgba(255, 40, 40, 0.35)";
      const warningBaseY = isGravityVisualFlipped() ? 50 : canvas.height - 50;
      const warningEndY = isGravityVisualFlipped() ? canvas.height : canvas.height - 60;
      const warningStartY = isGravityVisualFlipped() ? 60 : 0;
      ctx.beginPath();
      ctx.ellipse(wx, warningBaseY, 28, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 60, 60, 0.7)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx, warningStartY);
      ctx.lineTo(wx, warningEndY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = flash ? "#ff3333" : "#ffaaaa";
    ctx.textAlign = "center";
    ctx.fillText("⚠ SPIKE! ⚠", canvas.width / 2, 40);
    ctx.restore();
  }
}

function updateWarpPickups() {
  for (const item of warpPickups) {
    if (item.taken) continue;
    const dx = player.position.x - item.x;
    const dy = player.position.y - item.y;
    if (dx * dx + dy * dy < (item.r + 18) * (item.r + 18)) {
      if (warpCount < WARP_MAX) {
        item.taken = true;
        warpCount++;
        updateWarpButtonUI();
      }
    }
  }
}

function useWarp() {
  if (!gameStarted || gameOver || gameCleared) return;
  if (warpCount <= 0) return;
  warpCount--;
  updateWarpButtonUI();
  const targetX = player.position.x + WARP_DISTANCE;
  const groundY = isGravityVisualFlipped() ? 100 : canvas.height - 100;
  const ty = isGravityVisualFlipped()
    ? Math.max(player.position.y, groundY)
    : Math.min(player.position.y, groundY);
  if (typeof window.DRAW_RUN !== "undefined" && window.DRAW_RUN.warpTo) {
  }
  Body.setPosition(player, { x: targetX, y: ty });
  Body.setVelocity(player, { x: playerSpeed || 4, y: 0 });
  cameraX = player.position.x - canvas.width * 0.22;
  smoothCameraX = cameraX;
  try { addShake(4); spawnJuice(targetX, ty, "#c090ff", 12); speedLines = 22; } catch (e) {}
  while (currentX < cameraX + canvas.width + 800) {
    generateSegment();
  }
}

function updateWarpButtonUI() {
  const btn = document.getElementById("warp-button");
  const countEl = document.getElementById("warp-count");
  if (countEl) countEl.textContent = String(warpCount);
  if (btn) {
    btn.classList.toggle("disabled", warpCount <= 0);
    btn.style.display = gameStarted && !gameOver && !gameCleared && !abilityChoiceOpen ? "flex" : "none";
  }
  updateInvulnButtonUI();
}

function drawWarpPickups() {
  warpPickups.forEach(item => {
    if (item.taken) return;
    const sx = item.x - cameraX;
    if (sx < -50 || sx > canvas.width + 50) return;
    const size = 44;
    ctx.save();
    ctx.translate(sx, item.y);
    const bob = Math.sin(Date.now() / 200) * 4;
    if (warpItemImage.complete && warpItemImage.naturalWidth > 0) {
      if (isGravityVisualFlipped()) {
        ctx.scale(1, -1);
      }
      ctx.drawImage(warpItemImage, -size / 2, -size / 2 + bob, size, size);
    } else {
      ctx.fillStyle = "#9b59b6";
      ctx.beginPath();
      ctx.arc(0, bob, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function updateGroundSpikeGimmick() {
  if (!currentConfig || !currentConfig.groundSpikeEnabled) {
    if (groundSpikeState !== "idle") {
      endGimmick("groundSpike");
      groundSpikeState = "idle";
      slowMoFactor = 1;
      groundSpikeHeight = 0;
      if (groundSpikeBody) {
        World.remove(world, groundSpikeBody);
        groundSpikeBody = null;
      }
    }
    return;
  }
  const startAt = currentConfig.groundSpikeStartScore != null ? currentConfig.groundSpikeStartScore : 80;
  if (score < startAt) return;

  groundSpikeTimer++;
  const groundTop = canvas.height - 80;

  if (groundSpikeState === "idle") {
    if (tryStartGimmick("groundSpike")) {
      groundSpikeState = "warning";
      groundSpikeTimer = 0;
      groundSpikeX = player.position.x + 100 + Math.random() * 80;
      groundSpikeHeight = 0;
      slowMoFactor = 0.35;
    }
  } else if (groundSpikeState === "warning") {
    groundSpikeX = player.position.x + 90 + Math.random() * 40;
    if (groundSpikeTimer >= GS_WARNING_FRAMES) {
      groundSpikeState = "pop";
      groundSpikeTimer = 0;
      slowMoFactor = 1;
      const h = 90;
      groundSpikeHeight = h;
      if (groundSpikeBody) World.remove(world, groundSpikeBody);
      const spikeBodyY = isGravityVisualFlipped()
        ? groundTop + h / 2
        : groundTop - h / 2;
      groundSpikeBody = Bodies.rectangle(groundSpikeX, spikeBodyY, 36, h, {
        isStatic: true,
        label: "spike"
      });
      World.add(world, groundSpikeBody);
    }
  } else if (groundSpikeState === "pop") {
    if (groundSpikeTimer >= GS_POP_FRAMES) {
      groundSpikeState = "cooldown";
      groundSpikeTimer = 0;
      groundSpikeHeight = 0;
      if (groundSpikeBody) {
        World.remove(world, groundSpikeBody);
        groundSpikeBody = null;
      }
      gsCooldownTarget = GS_COOLDOWN_MIN + Math.floor(Math.random() * (GS_COOLDOWN_MAX - GS_COOLDOWN_MIN + 1));
      endGimmick("groundSpike");
    }
  } else if (groundSpikeState === "cooldown") {
    if (groundSpikeTimer >= gsCooldownTarget) {
      groundSpikeState = "idle";
      groundSpikeTimer = 0;
    }
  }
}

function drawFakeFloors() {
  fakeFloors.forEach(ff => {
    const sx = ff.x - cameraX;
    if (sx < -ff.w || sx > canvas.width + ff.w) return;
    ctx.save();
    ctx.globalAlpha = 0.62;
    if (groundImage.complete && groundImage.naturalWidth > 0) {
      if (isGravityVisualFlipped()) {
        ctx.translate(sx, ff.y);
        ctx.scale(1, -1);
        ctx.drawImage(groundImage, -ff.w / 2, -ff.h / 2, ff.w, ff.h);
      } else {
        ctx.drawImage(groundImage, sx - ff.w / 2, ff.y - ff.h / 2, ff.w, ff.h);
      }
    } else {
      ctx.fillStyle = "#555";
      ctx.fillRect(sx - ff.w / 2, ff.y - ff.h / 2, ff.w, ff.h);
    }
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(sx - ff.w / 2, ff.y - ff.h / 2, ff.w, ff.h);
    ctx.restore();
  });
}

function drawGroundSpikeWarning() {
  if (groundSpikeState !== "warning" && groundSpikeState !== "pop") return;
  const sx = groundSpikeX - cameraX;
  const groundTop = isGravityVisualFlipped() ? 80 : canvas.height - 80;

  ctx.save();
  if (groundSpikeState === "warning") {
    const flash = Math.sin(Date.now() / 60) > 0;
    ctx.fillStyle = flash ? "rgba(255, 40, 40, 0.55)" : "rgba(255, 100, 50, 0.35)";
    ctx.beginPath();
    ctx.ellipse(sx, groundTop + 6, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff2222";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx - 25, groundTop);
    ctx.lineTo(sx, groundTop - 8);
    ctx.lineTo(sx + 25, groundTop);
    ctx.stroke();
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = flash ? "#ff3333" : "#ffaaaa";
    ctx.textAlign = "center";
    const watchTextY = isGravityVisualFlipped() ? 110 : canvas.height - 100;
    const slowTextY = isGravityVisualFlipped() ? canvas.height - 70 : 70;
    ctx.fillText("⚠ WATCH OUT! ⚠", canvas.width / 2, watchTextY);
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("SLOW MOTION", canvas.width / 2, slowTextY);
  } else if (groundSpikeState === "pop") {
    const h = groundSpikeHeight || 90;
    ctx.beginPath();
    if (isGravityVisualFlipped()) {
      ctx.moveTo(sx, groundTop + h);
      ctx.lineTo(sx - 22, groundTop);
      ctx.lineTo(sx + 22, groundTop);
    } else {
      ctx.moveTo(sx, groundTop - h);
      ctx.lineTo(sx - 22, groundTop);
      ctx.lineTo(sx + 22, groundTop);
    }
    ctx.closePath();
    ctx.fillStyle = "#8B0000";
    ctx.strokeStyle = "#ff6666";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function updateBlinkPlatforms() {
  for (let i = blinkPlatforms.length - 1; i >= 0; i--) {
    const bp = blinkPlatforms[i];
    if (bp.x < cameraX - 600) {
      if (bp.body) World.remove(world, bp.body);
      blinkPlatforms.splice(i, 1);
      continue;
    }
    bp.timer++;
    if (bp.state === "solid" && bp.timer >= bp.solidFrames) {
      bp.state = "warning";
      bp.timer = 0;
    } else if (bp.state === "warning" && bp.timer >= bp.warningFrames) {
      bp.state = "gone";
      if (bp.body) {
        World.remove(world, bp.body);
        bp.body = null;
      }
    }
  }
}

function drawBlinkPlatforms() {
  blinkPlatforms.forEach(bp => {
    if (bp.state === "gone") return;
    const sx = bp.x - cameraX;
    if (sx < -100 || sx > canvas.width + 100) return;
    const flash = bp.state === "warning" && Math.sin(Date.now() / 50) > 0;
    ctx.save();
    ctx.globalAlpha = bp.state === "warning" ? (flash ? 0.9 : 0.25) : 0.85;
    ctx.fillStyle = bp.state === "warning" ? "#ff6633" : "#cc4422";
    ctx.fillRect(sx - bp.w / 2, bp.y - bp.h / 2, bp.w, bp.h);
    ctx.strokeStyle = "#ffaa66";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - bp.w / 2, bp.y - bp.h / 2, bp.w, bp.h);
    if (bp.state === "warning") {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", sx, bp.y + 4);
    }
    ctx.restore();
  });
}

function updateWindGimmick() {
  if (!currentConfig || !currentConfig.windEnabled) {
    if (windState !== "idle") {
      endGimmick("wind");
      windState = "idle";
    }
    return;
  }
  const startAt = currentConfig.windStartScore != null ? currentConfig.windStartScore : 20;
  if (score < startAt) return;

  windTimer++;

  if (windState === "idle") {
    if (tryStartGimmick("wind")) {
      windState = "warning";
      windTimer = 0;
      windDir = Math.random() < 0.7 ? -1 : 1; 
    }
  } else if (windState === "warning") {
    if (windTimer >= WIND_WARNING_FRAMES) {
      windState = "active";
      windTimer = 0;
    }
  } else if (windState === "active") {
    Body.setVelocity(player, {
      x: player.velocity.x,
      y: player.velocity.y + windDir * 0.55
    });
    if (windTimer >= WIND_ACTIVE_FRAMES) {
      windState = "cooldown";
      windTimer = 0;
      windCooldownTarget = WIND_COOLDOWN_MIN + Math.floor(Math.random() * (WIND_COOLDOWN_MAX - WIND_COOLDOWN_MIN + 1));
      endGimmick("wind");
    }
  } else if (windState === "cooldown") {
    if (windTimer >= windCooldownTarget) {
      windState = "idle";
      windTimer = 0;
    }
  }
}

function drawWindGimmick() {
  if (windState !== "warning" && windState !== "active") return;
  ctx.save();
  const flash = Math.sin(Date.now() / 80) > 0;
  if (windState === "warning") {
    ctx.fillStyle = flash ? "rgba(180, 220, 255, 0.2)" : "rgba(180, 220, 255, 0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "#aaddff";
    ctx.textAlign = "center";
    ctx.fillText(windDir < 0 ? "↑ WIND ↑" : "↓ WIND ↓", canvas.width / 2, 100);
  } else {
    ctx.strokeStyle = "rgba(180, 220, 255, 0.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const x = ((Date.now() / 8 + i * 50) % (canvas.width + 40)) - 20;
      ctx.beginPath();
      ctx.moveTo(x, windDir < 0 ? canvas.height : 0);
      ctx.lineTo(x + 20, windDir < 0 ? 0 : canvas.height);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function fixedUpdate() {
  if (gameOver || gameCleared) return;
  if (abilityChoiceOpen || isReviving || isCountingDown) {
    // 選択中・復活/開始カウント中は完全停止（裏で進行しない）
    try { Body.setVelocity(player, { x: 0, y: 0 }); } catch (e) {}
    return;
  }

  const baseGrav = normalGravityY;
  const cfg = currentConfig;
  if (!cfg) return;

  // 時間停止：プレイヤーはその場固定＋無敵、障害物・ギミックは動かす
  if (reviveInvulnFrames > 0) reviveInvulnFrames--;
  if (invulnActiveFrames > 0) invulnActiveFrames--;
  try { updateJuice(); } catch (e) {}
  if (!gameOver && !gameCleared && !isReviving && !isCountingDown) {
    try { checkNearMissJuice(); } catch (e) {}
  }

  if (freezeFrames > 0) {
    freezeFrames--;
    try {
      Body.setPosition(player, { x: freezeHoldX, y: freezeHoldY });
      Body.setVelocity(player, { x: 0, y: 0 });
      Body.setAngle(player, 0);
    } catch (e) {}
    cameraX = freezeHoldX - canvas.width * 0.1;
    stoppedTime = 0;
    airborneFrames = 0;
    upperZoneFrames = 0;
    engine.world.gravity.y = normalGravityY;

    // ギミックは通常通り進行
    updateLaserGimmick();
    updateGravityReverseGimmick();
    updateSpikeGimmick();
    updateGroundSpikeGimmick();
    updateRings();
    updateWarpPickups();
    updateBlinkPlatforms();
    updateWindGimmick();

    Engine.update(engine, FIXED_DT_MS);

    // 物理後もプレイヤーを固定（無敵は triggerGameOver 側）
    try {
      Body.setPosition(player, { x: freezeHoldX, y: freezeHoldY });
      Body.setVelocity(player, { x: 0, y: 0 });
      Body.setAngle(player, 0);
    } catch (e) {}
    updateInvulnButtonUI();
    return;
  }

  let speedMul = 1;
  if (isTouchingBoostLine) { speedMul = 1.75; speedLines = 18; }
  else if (isTouchingLine) { speedMul = 1.28; speedLines = Math.max(speedLines, 8); }
  const debugSpeed = (window.DRAW_RUN && window.DRAW_RUN.speedMul != null) ? window.DRAW_RUN.speedMul : 1;
  playerSpeed = cfg.baseSpeed * speedMul * debugSpeed;
  let vyOut = player.velocity.y;
  // 氷ステージ：接地中は横滑り（制御しにくい）
  if (cfg.iceSlip && isTouchingGroundOrLine && !isTouchingLine) {
    vyOut = player.velocity.y * 0.98;
  }
  Body.setVelocity(player, { x: playerSpeed, y: vyOut });
  {
    const camTarget = player.position.x - canvas.width * 0.22;
    if (!smoothCameraX) smoothCameraX = camTarget;
    smoothCameraX += (camTarget - smoothCameraX) * 0.14;
    cameraX = smoothCameraX;
  }

  // 通常重力中だけ上半分に長時間いる判定を行う。
  // 重力反転中は上側が通常の「床」になるため、この判定を無効化する。
  if (gravityReverseState !== "active" && gravityReverseState !== "warning") {
    if (player.position.y < canvas.height / 2) {
      upperZoneFrames++;
      if (upperZoneFrames >= 300) {
        triggerGameOver();
      }
    } else {
      upperZoneFrames = 0;
    }
  } else {
    upperZoneFrames = 0;
  }

  if (gravityReverseState !== "active" && gravityReverseState !== "warning") {
    if (isTouchingGroundOrLine) {
      airborneFrames = 0;
    } else {
      airborneFrames++;
    }

    if (airborneFrames > cfg.airborneGravityStart) {
      const extraWeight = Math.min(airborneFrames - cfg.airborneGravityStart, 100) * cfg.gravityIncrease;
      engine.world.gravity.y = baseGrav + extraWeight;
    } else {
      engine.world.gravity.y = baseGrav;
    }
  }

  updateLaserGimmick();
  updateGravityReverseGimmick();
  updateSpikeGimmick();
  updateGroundSpikeGimmick();
  updateRings();
  updateWarpPickups();
  updateBlinkPlatforms();
  updateWindGimmick();

  Engine.update(engine, FIXED_DT_MS);

  Body.setAngle(player, 0);

  cameraX = player.position.x - canvas.width * 0.1;
  score = Math.max(0, Math.floor((player.position.x - 200) / 100));

  checkAbilityChoiceTriggers();

  if (!cfg.isInfinite && score >= cfg.targetScore) {
    triggerGameClear();
  }

  if (currentX < cameraX + canvas.width + 800) {
    generateSegment();
  }

  for (let i = grounds.length - 1; i >= 0; i--) {
    if (grounds[i].position.x < cameraX - 600) {
      World.remove(world, grounds[i]);
      grounds.splice(i, 1);
    }
  }
  for (let i = walls.length - 1; i >= 0; i--) {
    if (walls[i].position.x < cameraX - 600) {
      World.remove(world, walls[i]);
      walls.splice(i, 1);
    }
  }
  for (let i = spikes.length - 1; i >= 0; i--) {
    if (spikes[i].position.y > canvas.height + 300 || spikes[i].position.x < cameraX - 600) {
      World.remove(world, spikes[i]);
      spikes.splice(i, 1);
    }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    if (rings[i].x < cameraX - 600) rings.splice(i, 1);
  }
  for (let i = warpPickups.length - 1; i >= 0; i--) {
    if (warpPickups[i].x < cameraX - 600 || warpPickups[i].taken) warpPickups.splice(i, 1);
  }
  for (let i = fakeFloors.length - 1; i >= 0; i--) {
    if (fakeFloors[i].x < cameraX - 600) fakeFloors.splice(i, 1);
  }

  if (player.position.y > canvas.height + 200) {
    triggerGameOver();
  }

  if (freezeFrames > 0 || abilityChoiceOpen || isReviving) {
    stoppedTime = 0;
  } else if (Math.abs(player.velocity.x) < 0.5) {
    stoppedTime += FIXED_DT_SEC;
  } else {
    stoppedTime = 0;
  }
  if (stoppedTime >= 3) {
    triggerGameOver();
  }
}

function gameLoop(now) {
  if (now == null) now = performance.now();
  let frameDelta = now - lastFrameTime;
  lastFrameTime = now;
  if (frameDelta > MAX_FRAME_MS) frameDelta = MAX_FRAME_MS;
  if (frameDelta < 0) frameDelta = 0;

  if (gameStarted) {
    if (!gameOver && !gameCleared) {
      timeAccumulator += frameDelta * (typeof slowMoFactor === "number" ? slowMoFactor : 1);
      while (timeAccumulator >= FIXED_DT_MS) {
        fixedUpdate();
        timeAccumulator -= FIXED_DT_MS;
      }
    } else {
      Body.setAngle(player, 0);
    }
  }

  if (drawing) {
    const elapsedTime = Date.now() - drawStartTime;
    if (elapsedTime >= getEffectiveMaxDrawTime()) releaseLines();
  }

  if (!gameStarted) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(gameLoop);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(shakeX || 0, shakeY || 0);

  const activeBg = getActiveBackground();
  if (gameStarted && activeBg && activeBg.procedural === "volcano") {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#1a0508");
    g.addColorStop(0.45, "#4a1208");
    g.addColorStop(0.75, "#8B2500");
    g.addColorStop(1, "#2a0800");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.15 + 0.05 * Math.sin(Date.now() / 400);
    ctx.fillStyle = "#ff4400";
    ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3);
    ctx.globalAlpha = 1;
  } else if (gameStarted && currentConfig && currentConfig.bgFixed === "ice") {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#d8f0ff");
    g.addColorStop(0.4, "#b8e0f8");
    g.addColorStop(0.75, "#e8f6ff");
    g.addColorStop(1, "#f5fcff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 73 + cameraX * 0.2) % canvas.width + canvas.width) % canvas.width;
      const sy = (i * 41 + Date.now() / 40) % canvas.height;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (gameStarted && activeBg && activeBg.procedural === "void") {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#020208");
    g.addColorStop(0.5, "#0a1028");
    g.addColorStop(1, "#120818");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(200,220,255,0.7)";
    for (let i = 0; i < 24; i++) {
      const sx = ((i * 97 + cameraX * 0.05) % canvas.width + canvas.width) % canvas.width;
      const sy = (i * 53) % canvas.height;
      ctx.fillRect(sx, sy, 2, 2);
    }
  } else if (gameStarted && activeBg && activeBg.complete && activeBg.width > 0) {
    const bgSpeed = 0.3;
    const bgHeight = canvas.height;
    const bgWidth = activeBg.width * (canvas.height / activeBg.height);
    let bgX = -((cameraX * bgSpeed) % bgWidth);
    if (bgX > 0) bgX -= bgWidth;

    ctx.drawImage(activeBg, bgX, 0, bgWidth, bgHeight);
    ctx.drawImage(activeBg, bgX + bgWidth - 1, 0, bgWidth, bgHeight);
    ctx.drawImage(activeBg, bgX + bgWidth * 2 - 2, 0, bgWidth, bgHeight);
  } else if (gameStarted) {
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ===== ゲーム世界の描画 =====
  // 物理座標そのものを反転済みなので、ここでは通常の描画を行う。
  grounds.forEach((ground) => { drawBody(ground, "black"); });
  walls.forEach((wall) => { drawBody(wall, "gray"); });

  world.bodies.forEach((body) => {
    if (body !== player && !grounds.includes(body) && !walls.includes(body) && body.label !== "spike") {
      drawBody(body, body._boosted ? "#00e5ff" : "black");
    }
  });

  drawBody(player, "red");

  if (!gameOver && !gameCleared) {
    drawGoal();
  }

  if (!gameOver && !gameCleared) {
    drawFakeFloors();
    drawBlinkPlatforms();
    drawWarpPickups();
    drawRings();
    drawSpikes();
    drawGroundSpikeWarning();
    drawWindGimmick();
  }

  if (!gameOver && !gameCleared) {
    drawLaserGimmick();
  }

  // 重力反転中の画面全体を薄く着色して状態を分かりやすくする
  drawGravityReverseOverlay();

  updateWarpButtonUI();

  if (gameOver || gameCleared) {
    ctx.save();

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "bold 48px 'Helvetica Neue', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (gameCleared) {
      ctx.shadowColor = "rgba(0, 255, 150, 0.8)";
      ctx.shadowBlur = 20;
      const gradient = ctx.createLinearGradient(
        canvas.width / 2, canvas.height / 2 - 60,
        canvas.width / 2, canvas.height / 2 + 20
      );
      gradient.addColorStop(0, "#33ff99");
      gradient.addColorStop(1, "#00aa55");
      ctx.fillStyle = gradient;
      ctx.fillText("STAGE CLEAR!", canvas.width / 2, canvas.height / 2 - 48);
      ctx.font = "bold 16px sans-serif";
      ctx.fillStyle = "#b8ffd8";
      if (stylePoints > 0) ctx.fillText("STYLE " + stylePoints + " pts", canvas.width / 2, canvas.height / 2 - 12);

      ctx.shadowBlur = 0;
      ctx.font = "bold 20px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${currentConfig.name}`, canvas.width / 2, canvas.height / 2 + 10);
      ctx.fillText(`SCORE : ${score}m`, canvas.width / 2, canvas.height / 2 + 40);
    } else {
      ctx.shadowColor = "rgba(255, 0, 0, 0.8)";
      ctx.shadowBlur = 20;
      const gradient = ctx.createLinearGradient(
        canvas.width / 2, canvas.height / 2 - 60,
        canvas.width / 2, canvas.height / 2 + 20
      );
      gradient.addColorStop(0, "#ff3333");
      gradient.addColorStop(1, "#990000");
      ctx.fillStyle = gradient;
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 30);

      ctx.shadowBlur = 0;
      ctx.font = "bold 22px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`SCORE : ${score}m`, canvas.width / 2, canvas.height / 2 + 25);
    }

    // ボタンは HTML #result-menu（ポップUI）

    // 演出パーティクル
    updateAndDrawResultFx();

    ctx.restore();
    ctx.textAlign = "left";
  } else if (resultFx.length) {
    updateAndDrawResultFx();
  }

  ctx.save();

  ctx.save();

  // 左上：距離パネルのみ（コンパクト）
  const panelX = 10;
  const panelY = 10;
  const panelW = 150;
  const panelH = 64;
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(panelX+2, panelY+3, panelW, panelH, 14); ctx.fill(); }
  const pg = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  pg.addColorStop(0, "rgba(255,255,255,0.95)");
  pg.addColorStop(1, "rgba(235,248,255,0.95)");
  ctx.fillStyle = pg;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 14); ctx.fill(); ctx.stroke(); }
  else { ctx.fillRect(panelX, panelY, panelW, panelH); }

  ctx.fillStyle = "#3b9eff";
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(panelX+8, panelY+8, 48, 18, 7); ctx.fill(); }
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DISTANCE", panelX+32, panelY+20);

  // ライフは右端に小さく
  const lives = Math.max(0, Number(reviveCharges) || 0);
  ctx.textAlign = "right";
  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = lives > 0 ? "#ff4d6d" : "rgba(255,120,140,0.5)";
  ctx.fillText(lives > 0 ? ("♥"+lives) : "♥0", panelX + panelW - 10, panelY + 21);

  ctx.textAlign = "left";
  ctx.fillStyle = "#1a3a6a";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(score + "m", panelX+12, panelY+48);

  if (currentConfig && !currentConfig.isInfinite && currentConfig.targetScore) {
    ctx.fillStyle = "#6a8aaa";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("/ " + currentConfig.targetScore + "m", panelX+78, panelY+46);
    const ratio = Math.max(0, Math.min(1, score / currentConfig.targetScore));
    ctx.fillStyle = "rgba(59,158,255,0.18)";
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(panelX+10, panelY+54, panelW-20, 5, 3); ctx.fill(); }
    ctx.fillStyle = "#3b9eff";
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(panelX+10, panelY+54, (panelW-20)*ratio, 5, 3); ctx.fill(); }
  }

  // INK READY ゲージは非表示

  // スタイルコンボ
  if (styleCombo > 1) {
    ctx.save();
    ctx.textAlign = "right";
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "#ffe566";
    ctx.shadowColor = "#ff9900";
    ctx.shadowBlur = 10;
    ctx.fillText("STYLE x" + styleCombo, canvas.width - 16, 38);
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#fff0a8";
    ctx.fillText(stylePoints + " pts", canvas.width - 16, 56);
    ctx.restore();
  }
  // 無敵リング
  if (invulnActiveFrames > 0 && player) {
    const pulse = 0.4 + 0.3 * Math.sin(Date.now() / 70);
    ctx.save();
    ctx.strokeStyle = "rgba(255,210,50," + pulse + ")";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.position.x - cameraX, player.position.y, 26 + pulse * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  try { drawJuice(); } catch (e) {}

  ctx.restore(); // shake

  requestAnimationFrame(gameLoop);
}

function clearFadeOverlay() {
  const fade = document.getElementById("fade-overlay");
  if (!fade) return;
  fade.classList.remove("circle-expand", "fade-in");
  fade.style.clipPath = "circle(0% at 50% 50%)";
}

function hideCountdownUI() {
  const countdownDisplay = document.getElementById("countdown-display");
  const countdownOverlay = document.getElementById("countdown-overlay");
  const countdownRing = document.getElementById("countdown-ring");
  if (countdownDisplay) countdownDisplay.classList.remove("visible");
  if (countdownOverlay) {
    countdownOverlay.classList.remove("visible");
    countdownOverlay.style.display = "none";
    countdownOverlay.style.opacity = "0";
    countdownOverlay.style.background = "";
  }
  if (countdownRing) countdownRing.classList.remove("visible");
}

/** 3→2→1→GO を確実に表示してから onComplete */
function runNumberCountdown(options) {
  const opts = options || {};
  const onComplete = typeof opts.onComplete === "function" ? opts.onComplete : function () {};
  const subForGo = opts.goSub || "GO!";
  const tips = opts.tips || { 3: "READY", 2: "SET", 1: "ALMOST" };
  const lightOverlay = !!opts.lightOverlay;

  if (countdownTimerId) {
    clearInterval(countdownTimerId);
    countdownTimerId = null;
  }
  isCountingDown = true;
  // カウント中は進行させない
  if (!opts.keepGameStarted) {
    gameStarted = false;
  }

  clearFadeOverlay();

  const countdownDisplay = document.getElementById("countdown-display");
  const countdownNumber = document.getElementById("countdown-number");
  const countdownSub = document.getElementById("countdown-sub");
  const countdownOverlay = document.getElementById("countdown-overlay");
  const countdownRing = document.getElementById("countdown-ring");

  function pulseRing() {
    if (!countdownRing) return;
    countdownRing.classList.remove("visible");
    void countdownRing.offsetWidth;
    countdownRing.classList.add("visible");
  }

  function showCount(value) {
    if (!countdownNumber) return;
    // アニメ再発火
    countdownNumber.style.animation = "none";
    countdownNumber.className = "";
    void countdownNumber.offsetWidth;
    countdownNumber.style.animation = "";

    if (value === "GO!") {
      countdownNumber.textContent = "GO!";
      countdownNumber.classList.add("cd-go");
      if (countdownSub) countdownSub.textContent = subForGo;
    } else {
      countdownNumber.textContent = String(value);
      countdownNumber.classList.add("cd-" + value);
      if (countdownSub) countdownSub.textContent = tips[value] || "GET READY";
    }
    if (value === 3) {
      try { playCountdownSfx(); } catch (e) {}
    }
    pulseRing();
  }

  if (!countdownDisplay || !countdownNumber) {
    isCountingDown = false;
    onComplete();
    return;
  }

  if (countdownOverlay) {
    countdownOverlay.style.display = "block";
    countdownOverlay.style.opacity = "1";
    if (lightOverlay) {
      // 復活時：ゲーム画面が透けて見える
      countdownOverlay.style.background = "rgba(8, 12, 28, 0.35)";
    } else {
      countdownOverlay.style.background = "";
    }
    countdownOverlay.classList.add("visible");
  }
  countdownDisplay.classList.add("visible");

  // 3 を先に描画してから1秒待つ（setIntervalだと最初の1秒で3が見えない端末がある）
  showCount(3);
  let step = 0;
  const steps = [2, 1, "GO!", null];
  countdownTimerId = setInterval(() => {
    const v = steps[step++];
    if (v === null) {
      clearInterval(countdownTimerId);
      countdownTimerId = null;
      hideCountdownUI();
      isCountingDown = false;
      onComplete();
    } else {
      showCount(v);
    }
  }, 1000);
}

function startCountdownAndGame() {
  hideResultMenu();
  hideSurveyNudge();
  const modeSelectScreen = document.getElementById("mode-select-screen");
  const subSelectScreen = document.getElementById("sub-select-screen");

  if (modeSelectScreen) modeSelectScreen.classList.remove("visible");
  if (subSelectScreen) subSelectScreen.classList.remove("visible");

  clearFadeOverlay();
  resetWorldForMode();
  try { recordStat("play"); } catch (e) {}

  const modeLabel = (currentConfig && currentConfig.name) ? currentConfig.name : "GET READY";

  runNumberCountdown({
    goSub: modeLabel,
    onComplete: () => {
      try {
        // 地面付近の安定位置から開始（ワープ・落下を防ぐ）
        Body.setPosition(player, { x: 200, y: canvas.height - 80 });
        Body.setVelocity(player, { x: (currentConfig && currentConfig.baseSpeed) || 4, y: 0 });
        Body.setAngle(player, 0);
      } catch (e) {}
      cameraX = 200 - canvas.width * 0.1;
      stoppedTime = 0;
      airborneFrames = 0;
      upperZoneFrames = 0;
      freezeFrames = 0;
      isCountingDown = false;
      gameStarted = true;
      try {
        playBGM.currentTime = 0;
        playBGM.play().catch(() => {});
      } catch (e) {}
    }
  });
}

function startReviveSequence() {
  if (isReviving || gameOver || gameCleared) return;
  isReviving = true;
  gameStarted = true;
  reviveHoldX = player.position.x;
  const centerY = canvas.height / 2;

  try { releaseLines(); } catch (e) {}
  try {
    Body.setPosition(player, { x: reviveHoldX, y: centerY });
    Body.setVelocity(player, { x: 0, y: 0 });
    Body.setAngularVelocity(player, 0);
  } catch (e) {}
  cameraX = reviveHoldX - canvas.width * 0.1;
  stoppedTime = 0;
  airborneFrames = 0;
  upperZoneFrames = 0;
  freezeFrames = 0;
  reviveInvulnFrames = 0;

  runNumberCountdown({
    goSub: "復活！",
    tips: { 3: "REVIVE", 2: "READY", 1: "SET" },
    lightOverlay: true,
    keepGameStarted: true,
    onComplete: () => {
      try {
        Body.setPosition(player, { x: reviveHoldX, y: centerY });
        Body.setVelocity(player, {
          x: (currentConfig && currentConfig.baseSpeed) || 4,
          y: 0
        });
        Body.setAngularVelocity(player, 0);
      } catch (e) {}
      cameraX = reviveHoldX - canvas.width * 0.1;
      stoppedTime = 0;
      airborneFrames = 0;
      upperZoneFrames = 0;
      isReviving = false;
      gameStarted = true;
      // 復活直後は短時間無敵（連続死亡防止）
      reviveInvulnFrames = 90;
    }
  });
}

const STAGE_AREA_NAMES = {
  1: "草原エリア",
  2: "夕暮れエリア",
  3: "夜空エリア",
  4: "サイバーエリア",
  5: "溶岩エリア"
};

const STAGE_ORDER = [
  "stage1-1", "stage1-2", "stage1-3",
  "stage2-1", "stage2-2", "stage2-3",
  "stage3-1", "stage3-2", "stage3-3",
  "stage4-1", "stage4-2", "stage4-3",
  "stage5-1", "stage5-2", "stage5-3"
];


const STAGE_DISPLAY_NAMES = {
  "stage1-1": "草原の砦",
  "stage1-2": "草原の道",
  "stage1-3": "草原の塔",
  "stage2-1": "夕暮れの村",
  "stage2-2": "夕暮れの丘",
  "stage2-3": "夕暮れの城",
  "stage3-1": "星降る道",
  "stage3-2": "月夜の遺跡",
  "stage3-3": "夜空の塔",
  "stage4-1": "電脳入口",
  "stage4-2": "回路街区",
  "stage4-3": "コア塔",
  "stage5-1": "溶岩の道",
  "stage5-2": "火口の橋",
  "stage5-3": "火山の城",
};

// 名所画像（あれば使用） landmark_1.png / landmark_2.png / landmark_3.png
// または landmark_w{world}_{sub}.png
function loadSpotLandmark(imgEl, world, sub) {
  if (!imgEl) return;
  const w = String(world);
  const s = String(sub);
  const namedBySub = { "1": "fort", "2": "ruins", "3": "tower" };
  const namedByWorld = {
    "1": { "1": "fort", "2": "ruins", "3": "tower" },
    "2": { "1": "lantern", "2": "bridge", "3": "sunset_castle" },
    "3": { "1": "starpath", "2": "moon_ruins", "3": "night_tower" },
    "4": { "1": "cyber_gate", "2": "circuit_block", "3": "core_tower" },
    "5": { "1": "lava_path", "2": "crater_bridge", "3": "volcano_castle" }
  };
  const wkey = (namedByWorld[w] || {})[s];
  const skey = namedBySub[s] || s;

  // 読み込み世代（ワールド切替の取り違え防止）
  const gen = (imgEl._lmGen = (imgEl._lmGen || 0) + 1);

  const baseNames = [
    "landmark_w" + w + "_" + s + ".png",
    "landmark_" + w + "-" + s + ".png",
    "landmark_" + w + "_" + s + ".png",
    wkey ? ("landmark_" + wkey + ".png") : null,
    wkey ? (wkey + ".png") : null,
    "landmark_" + skey + ".png",
    "landmark_" + s + ".png",
    // よくある別名
    s === "1" ? "landmark_fort.png" : null,
    s === "2" ? "landmark_ruins.png" : null,
    s === "3" ? "landmark_tower.png" : null
  ].filter(Boolean);

  const candidates = [];
  const seen = {};
  baseNames.forEach((n) => {
    assetDirCandidates(n).forEach((u) => {
      if (!seen[u]) { seen[u] = 1; candidates.push(u); }
    });
  });

  imgEl.style.display = "none";
  if (imgEl.parentElement) imgEl.parentElement.classList.remove("has-landmark");

  let i = 0;
  const tryNext = () => {
    if (gen !== imgEl._lmGen) return; // 古いリクエストは破棄
    if (i >= candidates.length) {
      imgEl.removeAttribute("src");
      imgEl.style.display = "none";
      if (imgEl.parentElement) imgEl.parentElement.classList.remove("has-landmark");
      return;
    }
    const url = candidates[i++];
    const probe = new Image();
    probe.onload = () => {
      if (gen !== imgEl._lmGen) return;
      imgEl.onload = null;
      imgEl.onerror = null;
      imgEl.src = url;
      imgEl.style.display = "block";
      imgEl.style.opacity = "1";
      imgEl.style.visibility = "visible";
      if (imgEl.parentElement) {
        imgEl.parentElement.classList.add("has-landmark");
      }
    };
    probe.onerror = tryNext;
    probe.src = url;
  };
  tryNext();
}

function setupImgButtonFallback(btn) {
  if (!btn) return;
  const img = btn.querySelector("img");
  if (!img) return;
  img.addEventListener("error", () => {
    btn.classList.add("no-img");
  });
  // すでに壊れている場合
  if (img.complete && img.naturalWidth === 0) {
    btn.classList.add("no-img");
  }
}

const WORLD_COUNT = 5;
let currentWorldPage = 1; // 1..5

function getClearedStages() {
  try {
    return JSON.parse(localStorage.getItem("drawRunStageClears")) || {};
  } catch (e) {
    return {};
  }
}

function isStageUnlocked(modeKey) {
  if (modeKey === "score") return true;
  const idx = STAGE_ORDER.indexOf(modeKey);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const prev = STAGE_ORDER[idx - 1];
  return !!getClearedStages()[prev];
}

function isMainStageUnlocked(mainNum) {
  return isStageUnlocked("stage" + mainNum + "-1");
}

function applyNodeLockState(btn, unlocked, cleared) {
  if (!btn) return;
  btn.classList.toggle("locked", !unlocked);
  btn.classList.toggle("cleared", !!cleared);
  btn.setAttribute("aria-disabled", unlocked ? "false" : "true");
}



// 木などの画像装飾（CSSの家・土管は使わない）
// 使えるファイル: tree.png / tree2.png / tree3.png / bush.png / rock.png
const WORLD_DECO_LAYOUT = {
  1: [
    { src: ["tree1.png", "tree.png", "tree1.png"], left: 8, top: 48, w: 48 },
    { src: ["tree2.png", "tree1.png", "tree.png"], left: 28, top: 55, w: 42 },
    { src: ["bush.png", "tree1.png", "tree.png"], left: 55, top: 70, w: 36 },
    { src: ["tree3.png", "tree1.png", "tree.png"], left: 68, top: 50, w: 50 },
    { src: ["tree1.png", "tree.png"], left: 88, top: 58, w: 44 }
  ],
  2: [
    { src: ["tree1.png", "tree.png", "tree2.png"], left: 10, top: 50, w: 46 },
    { src: ["tree2.png", "tree1.png", "tree.png"], left: 40, top: 58, w: 42 },
    { src: ["bush.png", "tree1.png", "tree.png"], left: 62, top: 68, w: 36 },
    { src: ["tree3.png", "tree1.png", "tree.png"], left: 85, top: 48, w: 48 }
  ],
  3: [
    { src: ["tree1.png", "tree.png"], left: 12, top: 55, w: 40 },
    { src: ["tree2.png", "tree1.png", "tree.png"], left: 50, top: 60, w: 44 },
    { src: ["tree3.png", "tree1.png", "tree.png"], left: 80, top: 52, w: 46 }
  ],
  4: [
    // サイバー／砂漠：木なし
  ],
  5: [
    // 溶岩：岩のみ（木なし）
    { src: ["rock.png"], left: 18, top: 62, w: 40 },
    { src: ["rock.png"], left: 55, top: 68, w: 36 }
  ],
};

function setImageWithFallback(img, candidates, onFail) {
  const list = [];
  (candidates || []).forEach((n) => {
    assetDirCandidates(n).forEach((u) => list.push(u));
  });
  let i = 0;
  const tryNext = () => {
    if (i >= list.length) {
      if (onFail) onFail();
      return;
    }
    const url = list[i++];
    const probe = new Image();
    probe.onload = () => {
      img.src = url;
      img.style.display = "";
    };
    probe.onerror = tryNext;
    probe.src = url;
  };
  tryNext();
}

function buildWorldDecorations(mainNum) {
  const layer = document.getElementById("map-deco-layer");
  if (!layer) return;
  layer.innerHTML = "";
  const list = WORLD_DECO_LAYOUT[mainNum] || WORLD_DECO_LAYOUT[1];
  list.forEach((d) => {
    const img = document.createElement("img");
    img.className = "deco deco-img";
    img.alt = "";
    img.style.left = d.left + "%";
    img.style.top = d.top + "%";
    img.style.width = (d.w || 44) + "px";
    img.style.height = "auto";
    img.style.position = "absolute";
    img.style.pointerEvents = "none";
    img.style.display = "none";
    img.style.filter = "drop-shadow(0 2px 3px rgba(0,0,0,0.35))";
    layer.appendChild(img);
    setImageWithFallback(img, d.src, () => { img.remove(); });
  });
}

function getSelectedSkinSrc() {
  let idx = parseInt(localStorage.getItem("drawRunSkinIndex"), 10) || 0;
  if (typeof characterList !== "undefined" && characterList.length) {
    if (idx < 0 || idx >= characterList.length) idx = 0;
    if (typeof isCharacterUnlocked === "function" && !isCharacterUnlocked(idx)) idx = 0;
    return characterList[idx].src;
  }
  const fallbacks = ["player.png", "player2.png", "player3.png", "player4.png", "player5.png", "player6.png", "player7.png", "player8.png"];
  return fallbacks[idx] || "player.png";
}

function updateMapCharToSpot(spotBtn) {
  const charEl = document.getElementById("map-char");
  const canvas = document.getElementById("world-map-canvas");
  if (!charEl || !canvas || !spotBtn) return;

  const skinName = getSelectedSkinSrc();
  // 確実に表示（成功したURLをセット）
  const candidates = assetDirCandidates(skinName);
  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) {
      charEl.style.display = "block";
      charEl.classList.add("visible");
      return;
    }
    const url = candidates[i++];
    const probe = new Image();
    probe.onload = () => {
      charEl.src = url;
      charEl.style.display = "block";
      charEl.style.opacity = "1";
      charEl.classList.add("visible");
    };
    probe.onerror = tryNext;
    probe.src = url;
  };

  charEl.style.left = spotBtn.style.left || "50%";
  charEl.style.top = spotBtn.style.top || "50%";
  charEl.classList.remove("visible");
  void charEl.offsetWidth;
  tryNext();
}

function hideMapChar() {
  const charEl = document.getElementById("map-char");
  if (charEl) charEl.classList.remove("visible");
}

function updateWorldPage(mainNum) {
  currentWorldPage = Math.max(1, Math.min(WORLD_COUNT, mainNum));
  const cleared = getClearedStages();

  const tag = document.getElementById("world-tag");
  const name = document.getElementById("world-name");
  const hint = document.getElementById("world-hint");
  const canvas = document.getElementById("world-map-canvas");
  const prevBtn = document.getElementById("world-prev");
  const nextBtn = document.getElementById("world-next");
  const selectedEl = document.getElementById("world-selected");
  const challengeBtn = document.getElementById("challenge-btn");

  if (tag) tag.textContent = "WORLD " + currentWorldPage;
  if (name) name.textContent = STAGE_AREA_NAMES[currentWorldPage] || "";

  // ワールドごとのバナー画像
  const bannerEl = document.getElementById("world-banner");
  const bannerImg = document.getElementById("world-banner-img");
  if (bannerImg) {
    const bannerNames = [
      "map_world_banner_" + currentWorldPage + ".png",
      "world_banner_" + currentWorldPage + ".png",
      "map_world_banner.png"
    ];
    const list = [];
    bannerNames.forEach((n) => {
      if (typeof assetDirCandidates === "function") {
        assetDirCandidates(n).forEach((u) => list.push(u));
      } else {
        list.push(n, "UI/" + n, "map/" + n);
      }
    });
    let bi = 0;
    const tryBanner = () => {
      if (bi >= list.length) {
        if (bannerEl) bannerEl.classList.remove("has-img");
        return;
      }
      const url = list[bi++];
      const probe = new Image();
      probe.onload = () => {
        bannerImg.src = url;
        bannerImg.style.display = "block";
        if (bannerEl) bannerEl.classList.add("has-img");
      };
      probe.onerror = tryBanner;
      probe.src = url;
    };
    tryBanner();
  }

  // 背景画像（無ければCSSグラデ）＋装飾
  if (canvas) {
    canvas.setAttribute("data-main", String(currentWorldPage));
    const mapNames = assetDirCandidates("map_world" + currentWorldPage + ".png");
    let mi = 0;
    const tryMap = () => {
      if (mi >= mapNames.length) {
        canvas.style.backgroundImage = "";
        return;
      }
      const imgUrl = mapNames[mi++];
      const probe = new Image();
      probe.onload = () => {
        canvas.style.backgroundImage = "url('" + imgUrl + "')";
      };
      probe.onerror = tryMap;
      probe.src = imgUrl;
    };
    tryMap();
  }
  buildWorldDecorations(currentWorldPage);

  const worldUnlocked = isMainStageUnlocked(currentWorldPage);
  if (hint) {
    if (!worldUnlocked) {
      hint.textContent = "前のワールドをクリアすると解放されます";
    } else {
      const allClear = [1, 2, 3].every((s) => cleared["stage" + currentWorldPage + "-" + s]);
      hint.textContent = allClear ? "このワールドはコンプリート！" : "地点を選んで「挑戦する」";
    }
  }

  selectedModeKey = null;
  if (selectedEl) {
    selectedEl.textContent = worldUnlocked ? "地点を選んでください" : "ロック中";
  }
  if (challengeBtn) challengeBtn.disabled = true;
  hideMapChar();

  const spots = Array.from(document.querySelectorAll(".map-spot")).sort((a, b) => {
    return (parseInt(a.dataset.sub, 10) || 0) - (parseInt(b.dataset.sub, 10) || 0);
  });
  spots.forEach((btn, idx) => {
    const sub = String(parseInt(btn.dataset.sub, 10) || (idx + 1));
    btn.dataset.sub = sub;
    const modeKey = "stage" + currentWorldPage + "-" + sub;
    btn.dataset.mode = modeKey;
    const numEl = btn.querySelector(".spot-label") || btn.querySelector(".node-num");
    if (numEl) numEl.textContent = currentWorldPage + "-" + sub;
    const plateTitle = btn.querySelector(".plate-title");
    if (plateTitle) {
      const stars = getStageDifficultyStars(modeKey);
      const starStr = "★".repeat(stars) + "☆".repeat(5 - stars);
      plateTitle.textContent = (STAGE_DISPLAY_NAMES[modeKey] || (currentWorldPage + "-" + sub)) + " " + starStr;
    }
    const landmark = btn.querySelector(".spot-landmark");
    loadSpotLandmark(landmark, currentWorldPage, sub);
    const unlocked = isStageUnlocked(modeKey);
    btn.classList.toggle("locked", !unlocked);
    btn.classList.toggle("cleared", !!cleared[modeKey]);
    btn.classList.remove("selected");
    btn.setAttribute("aria-disabled", unlocked ? "false" : "true");
  });

  if (prevBtn) prevBtn.disabled = currentWorldPage <= 1;
  if (nextBtn) nextBtn.disabled = currentWorldPage >= WORLD_COUNT;

  const dots = document.getElementById("world-dots");
  if (dots) {
    dots.innerHTML = "";
    for (let i = 1; i <= WORLD_COUNT; i++) {
      const d = document.createElement("button");
      d.type = "button";
      d.className = "world-dot" + (i === currentWorldPage ? " active" : "");
      d.setAttribute("aria-label", "WORLD " + i);
      d.addEventListener("click", () => {
        playButtonSfx();
        updateWorldPage(i);
      });
      dots.appendChild(d);
    }
  }

  // スクロール位置を左端へ
  const vp = document.getElementById("world-map-viewport");
  if (vp) vp.scrollLeft = 0;
}

let selectedModeKey = null;

function refreshMainMapLocks() {
  updateWorldPage(currentWorldPage);
}

function refreshSubMapLocks() {
  // 互換（サブ画面は使わない）
}

function openSubSelect(mainNum) {
  // ワールドページへ直接移動
  updateWorldPage(Number(mainNum) || 1);
}

function initWarpButton() {
  const btn = document.getElementById("warp-button");
  if (!btn) return;
  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (warpCount > 0) playButtonSfx();
    useWarp();
  };
  btn.addEventListener("click", handler);
  btn.addEventListener("touchstart", handler, { passive: false });
  updateWarpButtonUI();
}


function initMapSwipeScroll() {
  const vp = document.getElementById("world-map-viewport");
  if (!vp || vp.dataset.swipeInit === "1") return;
  vp.dataset.swipeInit = "1";

  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  let moved = false;

  const onDown = (clientX) => {
    dragging = true;
    moved = false;
    startX = clientX;
    startScroll = vp.scrollLeft;
  };
  const onMove = (clientX, e) => {
    if (!dragging) return;
    const dx = clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    vp.scrollLeft = startScroll - dx;
    if (e && e.cancelable && moved) e.preventDefault();
  };
  const onUp = () => { dragging = false; };

  vp.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    onDown(e.clientX);
  });
  window.addEventListener("mousemove", (e) => onMove(e.clientX, e));
  window.addEventListener("mouseup", onUp);

  vp.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    onDown(e.touches[0].clientX);
  }, { passive: true });
  vp.addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1) return;
    onMove(e.touches[0].clientX, e);
  }, { passive: false });
  vp.addEventListener("touchend", onUp);
  vp.addEventListener("touchcancel", onUp);

  // 地点クリックとドラッグを区別
  vp.addEventListener("click", (e) => {
    if (moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  // ワールド間スワイプ（端で大きく横に払う）
  let worldSwipeX = 0;
  let worldSwipeOn = false;
  const shell = document.querySelector(".world-shell");
  if (shell) {
    shell.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      worldSwipeOn = true;
      worldSwipeX = e.touches[0].clientX;
    }, { passive: true });
    shell.addEventListener("touchend", (e) => {
      if (!worldSwipeOn) return;
      worldSwipeOn = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - worldSwipeX;
      if (Math.abs(dx) < 70) return;
      // マップを大きくスクロール中ならワールド切替しない
      if (vp.scrollWidth > vp.clientWidth + 20) {
        const atLeft = vp.scrollLeft <= 8;
        const atRight = vp.scrollLeft + vp.clientWidth >= vp.scrollWidth - 8;
        if (dx > 0 && !atLeft) return;
        if (dx < 0 && !atRight) return;
      }
      if (dx < 0 && currentWorldPage < WORLD_COUNT) {
        playButtonSfx();
        updateWorldPage(currentWorldPage + 1);
      } else if (dx > 0 && currentWorldPage > 1) {
        playButtonSfx();
        updateWorldPage(currentWorldPage - 1);
      }
    }, { passive: true });
  }
}


function refreshSettingsPanel() {
  const s = loadPlayStats();
  const plays = document.getElementById("stat-plays");
  const dist = document.getElementById("stat-dist");
  const clears = document.getElementById("stat-clears");
  const deaths = document.getElementById("stat-deaths");
  const best = document.getElementById("stat-best");
  const abil = document.getElementById("stat-abil");
  if (plays) plays.textContent = String(s.playCount);
  if (dist) dist.textContent = Math.floor(s.totalDistance) + " m";
  if (clears) clears.textContent = String(s.clears);
  if (deaths) deaths.textContent = String(s.deaths);
  if (best) best.textContent = Math.floor(s.bestScore) + " m";
  if (abil) {
    const a = s.abilities || {};
    abil.textContent = "W" + (a.warp || 0) + " / R" + (a.revive || 0) + " / F" + (a.freeze || 0);
  }
  const seEn = document.getElementById("set-se-enabled");
  const seVol = document.getElementById("set-se-volume");
  if (seEn) seEn.checked = isSeEnabled();
  if (seVol) {
    const v = Number(getSavedSeValue("drawRunSeVolume"));
    seVol.value = Number.isFinite(v) ? v : 28;
  }
}

function initSettingsUI() {
  const btn = document.getElementById("settings-button");
  const overlay = document.getElementById("settings-overlay");
  const closeBtn = document.getElementById("settings-close");
  const seEn = document.getElementById("set-se-enabled");
  const seVol = document.getElementById("set-se-volume");
  function open() {
    if (overlay) overlay.classList.add("visible");
    refreshSettingsPanel();
  }
  function close() {
    if (overlay) overlay.classList.remove("visible");
  }
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { playButtonSfx(); } catch (err) {}
      open();
    });
  }
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = "1";
    closeBtn.addEventListener("click", () => {
      try { playButtonSfx(); } catch (err) {}
      close();
    });
  }
  if (overlay && !overlay.dataset.bound) {
    overlay.dataset.bound = "1";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }
  if (seEn && !seEn.dataset.bound) {
    seEn.dataset.bound = "1";
    seEn.addEventListener("change", () => {
      saveSeValue("drawRunSeEnabled", seEn.checked ? "true" : "false");
    });
  }
  if (seVol && !seVol.dataset.bound) {
    seVol.dataset.bound = "1";
    seVol.addEventListener("input", () => {
      saveSeValue("drawRunSeVolume", String(seVol.value));
    });
  }
}

function initModeSelectUI() {
  initWarpButton();
  initAbilityChoiceUI();
  initSettingsUI();
  initResultMenuUI();
  initMapSwipeScroll();
  setupImgButtonFallback(document.getElementById("challenge-btn"));
  setupImgButtonFallback(document.getElementById("mode-back-btn"));
  const startBtn = document.getElementById("start-button");
  const startScreen = document.getElementById("start-screen");
  const modeSelectScreen = document.getElementById("mode-select-screen");
  const subSelectScreen = document.getElementById("sub-select-screen");
  const modeBackBtn = document.getElementById("mode-back-btn");
  const subBackBtn = document.getElementById("sub-back-btn");
  const worldPrev = document.getElementById("world-prev");
  const worldNext = document.getElementById("world-next");

  // サブ画面は非表示固定
  if (subSelectScreen) {
    subSelectScreen.style.display = "none";
  }

  const scoreAttackBtn = document.getElementById("score-attack-button");

  function hideTitleButtons() {
    if (startBtn) startBtn.style.display = "none";
    if (scoreAttackBtn) scoreAttackBtn.style.display = "none";
    const setBtn = document.getElementById("settings-button");
    if (setBtn) setBtn.style.display = "none";
    const surveyBtn = document.getElementById("survey-button");
    if (surveyBtn) surveyBtn.style.display = "none";
    if (startScreen) {
      startScreen.querySelectorAll("a").forEach(btn => {
        if (btn.id === "survey-button") return;
        btn.style.display = "none";
      });
    }
  }

  function showTitleButtons() {
    if (startBtn) startBtn.style.display = "block";
    if (scoreAttackBtn) scoreAttackBtn.style.display = "block";
    const setBtn = document.getElementById("settings-button");
    if (setBtn) setBtn.style.display = "block";
    const surveyBtn = document.getElementById("survey-button");
    if (surveyBtn) surveyBtn.style.display = "block";
    if (startScreen) {
      startScreen.querySelectorAll("a").forEach(btn => {
        if (btn.id === "survey-button") return;
        btn.style.display = "block";
      });
    }
  }

  if (scoreAttackBtn) {
    scoreAttackBtn.addEventListener("click", () => {
      playButtonSfx();
      hideTitleButtons();
      const fade = document.getElementById("fade-overlay");
      if (fade) {
        fade.classList.remove("fade-in", "circle-expand");
        void fade.offsetWidth;
        fade.classList.add("circle-expand");
      }
      setTimeout(() => {
        if (startScreen) startScreen.classList.add("hidden");
        currentMode = "score";
        currentConfig = MODE_CONFIG.score;
        startCountdownAndGame();
        if (fade) setTimeout(() => fade.classList.remove("circle-expand"), 600);
      }, 280);
    });
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      playButtonSfx();
      hideTitleButtons();

      const fade = document.getElementById("fade-overlay");
      // 円形ワイプでマップへ
      if (fade) {
        fade.classList.remove("fade-in", "circle-expand");
        void fade.offsetWidth;
        fade.classList.add("circle-expand");
      }

      setTimeout(() => {
        if (startScreen) startScreen.classList.add("hidden");
        if (modeSelectScreen) {
          modeSelectScreen.classList.add("visible", "map-enter");
          // 常に WORLD1 から表示（順番が飛んで見えるのを防ぐ）
          updateWorldPage(1);
          // アニメ再発火用
          setTimeout(() => modeSelectScreen.classList.remove("map-enter"), 900);
        }
        if (fade) {
          setTimeout(() => fade.classList.remove("circle-expand"), 700);
        }
      }, 280);
    });
  }

  if (modeBackBtn) {
    modeBackBtn.addEventListener("click", () => {
      playButtonSfx();
      modeSelectScreen.classList.remove("visible");
      startScreen.classList.remove("hidden");
      showTitleButtons();
    });
  }

  if (subBackBtn) {
    subBackBtn.addEventListener("click", () => {
      playButtonSfx();
      if (subSelectScreen) subSelectScreen.classList.remove("visible");
      if (modeSelectScreen) {
        modeSelectScreen.classList.add("visible");
        updateWorldPage(currentWorldPage);
      }
    });
  }

  if (worldPrev) {
    worldPrev.addEventListener("click", () => {
      if (currentWorldPage <= 1) return;
      playButtonSfx();
      updateWorldPage(currentWorldPage - 1);
    });
  }
  if (worldNext) {
    worldNext.addEventListener("click", () => {
      if (currentWorldPage >= WORLD_COUNT) return;
      playButtonSfx();
      updateWorldPage(currentWorldPage + 1);
    });
  }

  if (modeSelectScreen) {
    modeSelectScreen.addEventListener("click", (e) => {
      const spot = e.target.closest(".map-spot");
      if (spot) {
        if (spot.classList.contains("locked")) return;
        const modeKey = spot.dataset.mode;
        if (!MODE_CONFIG[modeKey] || !isStageUnlocked(modeKey)) return;
        playButtonSfx();
        selectedModeKey = modeKey;
        document.querySelectorAll(".map-spot").forEach((b) => b.classList.remove("selected"));
        spot.classList.add("selected");
        updateMapCharToSpot(spot);
        const sel = document.getElementById("world-selected");
        if (sel) {
          const nice = STAGE_DISPLAY_NAMES[modeKey] || (MODE_CONFIG[modeKey].name || modeKey);
          sel.textContent = "選択中: " + nice;
        }
        const challengeBtn = document.getElementById("challenge-btn");
        if (challengeBtn) challengeBtn.disabled = false;
        return;
      }
    });
  }

  const challengeBtn = document.getElementById("challenge-btn");
  if (challengeBtn) {
    challengeBtn.addEventListener("click", () => {
      if (!selectedModeKey || !MODE_CONFIG[selectedModeKey]) return;
      if (!isStageUnlocked(selectedModeKey)) return;
      playButtonSfx();
      currentMode = selectedModeKey;
      currentConfig = MODE_CONFIG[selectedModeKey];

      const fade = document.getElementById("fade-overlay");
      if (fade) {
        fade.classList.remove("fade-in", "circle-expand");
        void fade.offsetWidth;
        fade.classList.add("circle-expand");
      }
      setTimeout(() => {
        startCountdownAndGame();
        if (fade) {
          setTimeout(() => fade.classList.remove("circle-expand"), 600);
        }
      }, 320);
    });
  }

  updateWorldPage(1);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initModeSelectUI);
} else {
  initModeSelectUI();
}

gameLoop();

window.DRAW_RUN = {
  invincible: false,   
  speedMul: 1,         
  get engine() { return engine; },
  get world() { return world; },
  get player() { return player; },
  get canvas() { return canvas; },
  get ctx() { return ctx; },
  get score() { return score; },
  get cameraX() { return cameraX; },
  get gameStarted() { return gameStarted; },
  get gameOver() { return gameOver; },
  get gameCleared() { return gameCleared; },
  get currentMode() { return currentMode; },
  get currentConfig() { return currentConfig; },
  get playerSpeed() { return playerSpeed; },
  get airborneFrames() { return airborneFrames; },
  get upperZoneFrames() { return upperZoneFrames; },
  get isTouchingGroundOrLine() { return isTouchingGroundOrLine; },
  get drawing() { return drawing; },
  get grounds() { return grounds; },
  get walls() { return walls; },
  get currentLines() { return currentLines; },
  get gravityY() { return engine.world.gravity.y; },
  get gravityWorldFlipped() { return gravityWorldFlipped; },
  triggerGameOver,
  triggerGameClear,
  MODE_CONFIG,
  warpTo(worldX, worldY) {
    if (!player) return;
    const y = (worldY != null) ? worldY : player.position.y;
    Body.setPosition(player, { x: worldX, y: y });
    Body.setVelocity(player, { x: playerSpeed || 4, y: 0 });
    cameraX = player.position.x - canvas.width * 0.1;
    while (currentX < cameraX + canvas.width + 800) {
      generateSegment();
    }
  }
};