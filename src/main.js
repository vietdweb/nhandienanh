import { VisionManager } from './ai/visionManager.js';
import { CanvasRenderer } from './ui/canvasRenderer.js';
import { SoundManager } from './audio/soundManager.js';

// DOM Elements
const video = document.getElementById('webcam-video');
const canvas = document.getElementById('canvas-overlay');
const overlayMessage = document.getElementById('overlay-message');
const overlaySpinner = document.getElementById('overlay-spinner');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const btnStartCamera = document.getElementById('btn-start-camera');

// Badges & Banners
const aiStatusText = document.getElementById('ai-status-text');
const personStatusText = document.getElementById('person-status-text');
const personConfidence = document.getElementById('person-confidence');
const personTag = document.getElementById('person-tag');

// Huge Number Display
const hugeDisplay = document.getElementById('huge-display');
const displayNumber = document.getElementById('display-number');
const displayLabel = document.getElementById('display-label');

// Finger Dots
const dotThumb = document.getElementById('dot-thumb');
const dotIndex = document.getElementById('dot-index');
const dotMiddle = document.getElementById('dot-middle');
const dotRing = document.getElementById('dot-ring');
const dotPinky = document.getElementById('dot-pinky');

// Cards 1 - 5
const numCards = {
  1: document.getElementById('card-num-1'),
  2: document.getElementById('card-num-2'),
  3: document.getElementById('card-num-3'),
  4: document.getElementById('card-num-4'),
  5: document.getElementById('card-num-5')
};

// Telemetry
const statFps = document.getElementById('stat-fps');
const statLatency = document.getElementById('stat-latency');
const statHands = document.getElementById('stat-hands');
const statPersons = document.getElementById('stat-persons');

// Controls
const btnToggleCamera = document.getElementById('btn-toggle-camera');
const btnToggleMirror = document.getElementById('btn-toggle-mirror');
const btnToggleSkeleton = document.getElementById('btn-toggle-skeleton');
const btnTogglePose = document.getElementById('btn-toggle-pose');
const btnToggleVoice = document.getElementById('btn-toggle-voice');
const btnSnapshot = document.getElementById('btn-snapshot');

// Game Elements
const btnStartGame = document.getElementById('btn-start-game');
const challengeTargetText = document.getElementById('challenge-target-text');
const gameScoreEl = document.getElementById('game-score');
const gameTimerEl = document.getElementById('game-timer');

// App Instances
const vision = new VisionManager();
const renderer = new CanvasRenderer(canvas);
const sound = new SoundManager();

// App State
let mediaStream = null;
let isCameraRunning = false;
let isMirror = true;
let lastDisplayedNumber = null;
let frameCount = 0;
let lastFpsUpdate = performance.now();
let currentFps = 0;

// Game State
let isGameActive = false;
let gameTargetNumber = 0;
let gameScore = 0;
let gameTimer = 0;
let gameInterval = null;
let matchHoldCount = 0;

// Khởi chạy hệ thống AI
async function initApp() {
  try {
    if (aiStatusText) aiStatusText.textContent = 'Đang nạp Vision AI...';
    await vision.init((progressMsg) => {
      overlayDesc.textContent = progressMsg;
      if (aiStatusText) aiStatusText.textContent = progressMsg;
    });

    if (aiStatusText) aiStatusText.textContent = 'AI Sẵn sàng';
    overlaySpinner.style.display = 'none';
    overlayTitle.textContent = 'Khởi động Camera của bạn';
    overlayDesc.textContent = 'Cho phép trình duyệt truy cập Webcam để bắt đầu nhận diện người và đếm ngón tay.';
    btnStartCamera.style.display = 'inline-flex';

    // Tự động yêu cầu bật camera
    await startCamera();
  } catch (err) {
    console.error('Lỗi khi nạp AI:', err);
    overlaySpinner.style.display = 'none';
    overlayTitle.textContent = 'Không thể nạp AI';
    overlayDesc.textContent = 'Lỗi: ' + (err.message || err) + '. Vui lòng kiểm tra kết nối hoặc tải lại trang.';
    if (aiStatusText) aiStatusText.textContent = 'Lỗi nạp AI';
  }
}

// Bật Camera
async function startCamera() {
  try {
    overlayTitle.textContent = 'Đang kết nối Camera...';
    overlayDesc.textContent = 'Vui lòng cấp quyền (Allow) truy cập Camera khi trình duyệt yêu cầu.';
    btnStartCamera.style.display = 'none';
    overlaySpinner.style.display = 'block';

    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    };

    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = mediaStream;

    video.onloadedmetadata = () => {
      video.play();
      isCameraRunning = true;
      overlayMessage.style.display = 'none';
      btnToggleCamera.classList.add('active');
      btnToggleCamera.innerHTML = '<span>📹</span> Camera: Bật';

      updateCanvasDimensions();
      requestAnimationFrame(renderLoop);
    };
  } catch (camErr) {
    console.warn('Lỗi Camera:', camErr);
    overlaySpinner.style.display = 'none';
    overlayTitle.textContent = 'Chưa bật được Camera';
    overlayDesc.textContent = 'Trình duyệt chưa được cấp quyền Camera hoặc máy tính chưa kết nối Webcam. Hãy bấm nút dưới để thử lại.';
    btnStartCamera.style.display = 'inline-flex';
    btnStartCamera.textContent = 'Thử lại kết nối Camera';
  }
}

// Tắt Camera
function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  isCameraRunning = false;
  btnToggleCamera.classList.remove('active');
  btnToggleCamera.innerHTML = '<span>📹</span> Camera: Tắt';
  renderer.clear();
  overlayMessage.style.display = 'flex';
  overlayTitle.textContent = 'Camera đã tạm dừng';
  overlayDesc.textContent = 'Bấm "Bật Camera" trên thanh công cụ để tiếp tục nhận diện.';
  btnStartCamera.style.display = 'inline-flex';
  btnStartCamera.textContent = 'Bật Camera';
}

function updateCanvasDimensions() {
  if (video.videoWidth && video.videoHeight) {
    renderer.resize(video.videoWidth, video.videoHeight);
  }
}

window.addEventListener('resize', updateCanvasDimensions);

// Vòng lặp xử lý hình ảnh thời gian thực (Real-time Render Loop)
function renderLoop(timestamp) {
  if (!isCameraRunning || !video || video.paused || video.ended) {
    return;
  }

  // Cập nhật FPS mỗi 500ms
  frameCount++;
  const now = performance.now();
  if (now - lastFpsUpdate >= 500) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
    statFps.textContent = `${currentFps} FPS`;
    frameCount = 0;
    lastFpsUpdate = now;
  }

  // Xử lý khung hình với Vision AI
  const visionData = vision.processVideoFrame(video, timestamp);

  if (visionData) {
    // 1. Vẽ các hiệu ứng lên Canvas
    renderer.drawFrame(visionData);

    // 2. Cập nhật Telemetry
    statLatency.textContent = `${visionData.inferenceTimeMs} ms`;
    statHands.textContent = `${visionData.hands.length} tay`;
    statPersons.textContent = `${visionData.person.count} người`;

    // 3. Cập nhật Nhận diện Người (Human Detection)
    if (visionData.person && visionData.person.detected) {
      personTag.classList.add('detected');
      personStatusText.textContent = `Đã phát hiện ${visionData.person.count} người trong khung hình`;
      personConfidence.textContent = `${visionData.person.confidence}% Tự tin`;
    } else {
      personTag.classList.remove('detected');
      personStatusText.textContent = 'Đang quét tìm kiếm người...';
      personConfidence.textContent = '--%';
    }

    // 4. Cập nhật Số ngón tay và Cử chỉ (Finger & Gesture Display)
    if (visionData.hands && visionData.hands.length > 0) {
      // Ưu tiên hiển thị bàn tay thứ nhất
      const primaryHand = visionData.hands[0];
      const count = visionData.hands.length === 1 ? primaryHand.count : visionData.totalFingers;

      // Cập nhật thẻ số lớn
      displayNumber.textContent = count;
      displayLabel.textContent = primaryHand.specialDescription || (count === 0 ? 'Nắm đấm / 0 ngón' : `Số ${count}`);

      // Kích hoạt hiệu ứng pulse khi thay đổi số
      if (count !== lastDisplayedNumber) {
        hugeDisplay.classList.add('pulse');
        setTimeout(() => hugeDisplay.classList.remove('pulse'), 250);
        lastDisplayedNumber = count;
      }

      // Cập nhật trạng thái 5 ngón tay
      updateFingerDots(primaryHand.fingers);

      // Sáng thẻ số 1 - 5 tương ứng
      highlightNumberCard(count);

      // Đọc số tiếng Việt & âm thanh
      sound.handleNumberDetection(count, primaryHand.gesture);

      // Kiểm tra trong Mini Game
      checkGameProgress(count);
    } else {
      // Không phát hiện tay
      displayNumber.textContent = '-';
      displayLabel.textContent = 'Chờ ngón tay...';
      updateFingerDots({ thumb: false, index: false, middle: false, ring: false, pinky: false });
      highlightNumberCard(null);
      sound.handleNumberDetection(null);
      lastDisplayedNumber = null;
    }
  }

  requestAnimationFrame(renderLoop);
}

// Cập nhật trạng thái chấm 5 ngón
function updateFingerDots(fingers) {
  dotThumb.classList.toggle('active', !!fingers.thumb);
  dotIndex.classList.toggle('active', !!fingers.index);
  dotMiddle.classList.toggle('active', !!fingers.middle);
  dotRing.classList.toggle('active', !!fingers.ring);
  dotPinky.classList.toggle('active', !!fingers.pinky);
}

// Highlight thẻ số 1..5
function highlightNumberCard(activeNum) {
  for (let i = 1; i <= 5; i++) {
    if (numCards[i]) {
      numCards[i].classList.toggle('active', i === activeNum);
    }
  }
}

// ==================== MINI-GAME THỬ THÁCH RA DẤU ====================
function startChallengeGame() {
  if (isGameActive) {
    stopChallengeGame();
    return;
  }

  isGameActive = true;
  gameScore = 0;
  gameScoreEl.textContent = '0';
  btnStartGame.textContent = 'Dừng chơi';
  btnStartGame.classList.add('primary');

  sound.playTone(587.33, 'sine', 0.2); // D5 chime
  nextChallengeRound();
}

function stopChallengeGame() {
  isGameActive = false;
  clearInterval(gameInterval);
  challengeTargetText.textContent = `Trò chơi kết thúc! Tổng điểm của bạn: ${gameScore}`;
  gameTimerEl.textContent = '--s';
  btnStartGame.textContent = 'Chơi lại';
  btnStartGame.classList.remove('primary');
}

function nextChallengeRound() {
  if (!isGameActive) return;

  // Chọn ngẫu nhiên số từ 1 đến 5
  gameTargetNumber = Math.floor(Math.random() * 5) + 1;
  challengeTargetText.innerHTML = `Hãy giơ nhanh <span>${gameTargetNumber} ngón tay</span>!`;

  gameTimer = 6;
  gameTimerEl.textContent = `${gameTimer}s`;
  matchHoldCount = 0;

  clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    gameTimer--;
    gameTimerEl.textContent = `${gameTimer}s`;
    if (gameTimer <= 0) {
      sound.playTone(180, 'sawtooth', 0.3); // Tiếng hết giờ
      nextChallengeRound();
    }
  }, 1000);
}

function checkGameProgress(detectedCount) {
  if (!isGameActive) return;

  if (detectedCount === gameTargetNumber) {
    matchHoldCount++;
    // Nếu giữ đúng số ngón trong ~0.3s (10 frames)
    if (matchHoldCount >= 8) {
      gameScore += 10;
      gameScoreEl.textContent = gameScore;
      sound.playTone(880, 'triangle', 0.25); // Tiếng ăn điểm vui vẻ
      matchHoldCount = 0;
      clearInterval(gameInterval);
      challengeTargetText.innerHTML = `🎉 Tuyệt vời! Chính xác <span>${gameTargetNumber} ngón</span>! (+10đ)`;
      setTimeout(() => {
        nextChallengeRound();
      }, 900);
    }
  } else {
    matchHoldCount = 0;
  }
}

// ==================== CÁC NÚT ĐIỀU KHIỂN ====================

// Bật / Tắt Camera
btnToggleCamera.addEventListener('click', () => {
  if (isCameraRunning) {
    stopCamera();
  } else {
    startCamera();
  }
});

btnStartCamera.addEventListener('click', () => {
  startCamera();
});

// Lật gương video (Mirror mode)
btnToggleMirror.addEventListener('click', () => {
  isMirror = !isMirror;
  renderer.mirror = isMirror;
  video.classList.toggle('normal-view', !isMirror);
  btnToggleMirror.classList.toggle('active', isMirror);
  btnToggleMirror.textContent = `🪞 Gương: ${isMirror ? 'Bật' : 'Tắt'}`;
});

// Bật / Tắt Khung xương bàn tay
btnToggleSkeleton.addEventListener('click', () => {
  renderer.showHands = !renderer.showHands;
  btnToggleSkeleton.classList.toggle('active', renderer.showHands);
  btnToggleSkeleton.textContent = `🦴 Khung xương: ${renderer.showHands ? 'Bật' : 'Tắt'}`;
});

// Bật / Tắt Khung Người
btnTogglePose.addEventListener('click', () => {
  renderer.showPose = !renderer.showPose;
  vision.enablePose = renderer.showPose;
  btnTogglePose.classList.toggle('active', renderer.showPose);
  btnTogglePose.textContent = `👤 Khung Người: ${renderer.showPose ? 'Bật' : 'Tắt'}`;
});

// Bật / Tắt Đọc số tiếng Việt
btnToggleVoice.addEventListener('click', () => {
  sound.voiceEnabled = !sound.voiceEnabled;
  btnToggleVoice.classList.toggle('active', sound.voiceEnabled);
  btnToggleVoice.textContent = `🔊 Giọng đọc: ${sound.voiceEnabled ? 'Bật' : 'Tắt'}`;
});

// Nút Bắt đầu chơi Game phản xạ
btnStartGame.addEventListener('click', () => {
  startChallengeGame();
});

// Chụp ảnh khoảnh khắc (Snapshot)
btnSnapshot.addEventListener('click', () => {
  if (!video.videoWidth || !video.videoHeight) return;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = video.videoWidth;
  tempCanvas.height = video.videoHeight;
  const tempCtx = tempCanvas.getContext('2d');

  // Vẽ hình ảnh từ video (lật gương nếu mirror)
  tempCtx.save();
  if (isMirror) {
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, -tempCanvas.width, 0, tempCanvas.width, tempCanvas.height);
  } else {
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
  }
  tempCtx.restore();

  // Vẽ lớp Canvas Overlay lên trên
  tempCtx.drawImage(canvas, 0, 0);

  // Thêm đóng dấu thương hiệu góc ảnh
  tempCtx.font = 'bold 20px "Orbitron", monospace, sans-serif';
  tempCtx.fillStyle = '#00ffcc';
  tempCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  tempCtx.shadowBlur = 6;
  tempCtx.fillText('NEXUS VISION AI', 24, tempCanvas.height - 24);

  // Tải file ảnh PNG về máy
  const link = document.createElement('a');
  link.download = `nexus-vision-${Date.now()}.png`;
  link.href = tempCanvas.toDataURL('image/png');
  link.click();

  sound.playTone(700, 'sine', 0.1);
});

// Nút Demo Giả lập (không cần Camera)
const btnDemoMode = document.getElementById('btn-demo-mode');
let isDemoMode = false;
let demoInterval = null;
let demoStep = 1;

function generateSimulatedHand(fingerCount) {
  // Tạo bộ 21 điểm mốc giả lập theo số lượng ngón mở
  const base = [
    { x: 0.5, y: 0.8 },   // 0: Wrist
    { x: 0.44, y: 0.73 }, // 1: Thumb CMC
    { x: 0.38, y: 0.65 }, // 2: Thumb MCP
    { x: 0.34, y: 0.58 }, // 3: Thumb IP
    { x: 0.30, y: 0.52 }, // 4: Thumb TIP (default open)
    { x: 0.44, y: 0.58 }, // 5: Index MCP
    { x: 0.43, y: 0.48 }, // 6: Index PIP
    { x: 0.42, y: 0.40 }, // 7: Index DIP
    { x: 0.41, y: 0.32 }, // 8: Index TIP
    { x: 0.50, y: 0.56 }, // 9: Middle MCP
    { x: 0.50, y: 0.45 }, // 10: Middle PIP
    { x: 0.50, y: 0.37 }, // 11: Middle DIP
    { x: 0.50, y: 0.28 }, // 12: Middle TIP
    { x: 0.56, y: 0.58 }, // 13: Ring MCP
    { x: 0.57, y: 0.48 }, // 14: Ring PIP
    { x: 0.58, y: 0.41 }, // 15: Ring DIP
    { x: 0.59, y: 0.34 }, // 16: Ring TIP
    { x: 0.62, y: 0.62 }, // 17: Pinky MCP
    { x: 0.64, y: 0.55 }, // 18: Pinky PIP
    { x: 0.65, y: 0.49 }, // 19: Pinky DIP
    { x: 0.66, y: 0.43 }  // 20: Pinky TIP
  ];

  // Gập ngón tay lại nếu không nằm trong số đếm
  // 1: Chỉ Index mở (ngón 8 mở)
  // 2: Index + Middle mở (8, 12 mở)
  // 3: Index + Middle + Ring mở (8, 12, 16 mở)
  // 4: Index + Middle + Ring + Pinky mở (8, 12, 16, 20 mở)
  // 5: Cả 5 ngón mở (4, 8, 12, 16, 20 mở)
  // 0: Nắm đấm (gập cả 5)
  const isThumb = fingerCount === 5;
  const isIndex = fingerCount >= 1;
  const isMiddle = fingerCount >= 2;
  const isRing = fingerCount >= 3;
  const isPinky = fingerCount >= 4;

  if (!isThumb) {
    base[4] = { x: 0.42, y: 0.65 }; // gập cái
  }
  if (!isIndex) {
    base[7] = { x: 0.44, y: 0.60 };
    base[8] = { x: 0.44, y: 0.65 }; // gập trỏ
  }
  if (!isMiddle) {
    base[11] = { x: 0.50, y: 0.60 };
    base[12] = { x: 0.50, y: 0.65 }; // gập giữa
  }
  if (!isRing) {
    base[15] = { x: 0.56, y: 0.60 };
    base[16] = { x: 0.56, y: 0.65 }; // gập áp út
  }
  if (!isPinky) {
    base[19] = { x: 0.62, y: 0.63 };
    base[20] = { x: 0.63, y: 0.66 }; // gập út
  }

  return base;
}

function generateSimulatedPose() {
  const pose = [];
  for (let i = 0; i < 33; i++) {
    pose.push({ x: 0.5, y: 0.5, visibility: 0.9 });
  }
  pose[11] = { x: 0.38, y: 0.45, visibility: 0.95 }; // Vai trái
  pose[12] = { x: 0.62, y: 0.45, visibility: 0.95 }; // Vai phải
  pose[13] = { x: 0.30, y: 0.60, visibility: 0.95 }; // Khuỷu trái
  pose[14] = { x: 0.70, y: 0.60, visibility: 0.95 }; // Khuỷu phải
  pose[15] = { x: 0.42, y: 0.72, visibility: 0.95 }; // Cổ tay trái
  pose[16] = { x: 0.65, y: 0.72, visibility: 0.95 }; // Cổ tay phải
  pose[23] = { x: 0.42, y: 0.85, visibility: 0.95 }; // Hông trái
  pose[24] = { x: 0.58, y: 0.85, visibility: 0.95 }; // Hông phải
  return pose;
}

function runDemoStep() {
  if (!canvas.width || !canvas.height) {
    renderer.resize(1280, 720);
  }

  overlayMessage.style.display = 'none';
  const simulatedLandmarks = generateSimulatedHand(demoStep);
  const handData = {
    count: demoStep,
    gesture: demoStep === 0 ? 'Fist' : (demoStep === 2 ? 'Peace' : (demoStep === 5 ? 'Open Palm' : `Số ${demoStep}`)),
    gestureIcon: demoStep === 0 ? '✊' : (demoStep === 1 ? '☝️' : (demoStep === 2 ? '✌️' : (demoStep === 5 ? '🖐️' : '🔢'))),
    specialDescription: demoStep === 0 ? 'Nắm đấm / 0 ngón' : (demoStep === 2 ? 'Số 2 - Chữ V / Peace' : (demoStep === 5 ? 'Số 5 - Bàn tay mở' : `Số ${demoStep}`)),
    fingers: {
      thumb: demoStep === 5,
      index: demoStep >= 1,
      middle: demoStep >= 2,
      ring: demoStep >= 3,
      pinky: demoStep >= 4
    },
    handedness: 'Right',
    center: { x: 0.5, y: 0.55 },
    bbox: { x: 0.3, y: 0.25, width: 0.4, height: 0.55 },
    landmarks: simulatedLandmarks
  };

  const visionData = {
    hands: [handData],
    totalFingers: demoStep,
    person: {
      detected: true,
      count: 1,
      confidence: 96,
      bbox: { x: 0.28, y: 0.2, width: 0.44, height: 0.7 },
      landmarks: generateSimulatedPose()
    },
    inferenceTimeMs: 12
  };

  // Vẽ Canvas và cập nhật UI
  renderer.drawFrame(visionData);

  // Cập nhật thẻ số lớn
  displayNumber.textContent = demoStep;
  displayLabel.textContent = handData.specialDescription;
  hugeDisplay.classList.add('pulse');
  setTimeout(() => hugeDisplay.classList.remove('pulse'), 250);

  updateFingerDots(handData.fingers);
  highlightNumberCard(demoStep);
  sound.handleNumberDetection(demoStep, handData.gesture);
  checkGameProgress(demoStep);

  // Cập nhật người & Telemetry
  personTag.classList.add('detected');
  personStatusText.textContent = 'Đã phát hiện 1 người (Chế độ Demo)';
  personConfidence.textContent = '96% Tự tin';
  statFps.textContent = '60 FPS';
  statLatency.textContent = '12 ms';
  statHands.textContent = '1 tay';
  statPersons.textContent = '1 người';

  // Tăng số cho vòng lặp kế tiếp (0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 0)
  demoStep = (demoStep + 1) % 6;
}

btnDemoMode.addEventListener('click', () => {
  isDemoMode = !isDemoMode;
  btnDemoMode.classList.toggle('active', isDemoMode);

  if (isDemoMode) {
    btnDemoMode.textContent = '⏹️ Dừng Demo';
    if (isCameraRunning) {
      video.pause();
    }
    demoStep = 1;
    runDemoStep();
    demoInterval = setInterval(runDemoStep, 1800);
  } else {
    btnDemoMode.textContent = '✨ Demo Giả lập';
    clearInterval(demoInterval);
    demoInterval = null;
    renderer.clear();
    if (isCameraRunning) {
      video.play();
    } else {
      overlayMessage.style.display = 'flex';
    }
  }
});

// Khởi chạy
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

