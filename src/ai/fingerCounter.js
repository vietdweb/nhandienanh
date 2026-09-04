/**
 * Thuật toán phân tích tọa độ 21 điểm mốc bàn tay (MediaPipe Hand Landmarks)
 * Nhận diện trạng thái từng ngón tay (Mở / Đóng), đếm số ngón (0 -> 5), và phân loại cử chỉ đặc biệt.
 */

// Tính khoảng cách Euclidean giữa 2 điểm trong không gian 2D/3D
function getDistance(p1, p2, useZ = false) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  if (useZ && p1.z !== undefined && p2.z !== undefined) {
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return Math.hypot(dx, dy);
}

// Tính góc giữa 3 điểm (p1 - p2 - p3), đỉnh tại p2 (đơn vị: độ)
function getAngle(p1, p2, p3) {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cosine = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function analyzeHand(landmarks, handedness = 'Right') {
  if (!landmarks || landmarks.length < 21) {
    return null;
  }

  const wrist = landmarks[0];

  // Các điểm mốc quan trọng
  // Ngón cái: 1 CMC, 2 MCP, 3 IP, 4 TIP
  // Ngón trỏ: 5 MCP, 6 PIP, 7 DIP, 8 TIP
  // Ngón giữa: 9 MCP, 10 PIP, 11 DIP, 12 TIP
  // Ngón áp út: 13 MCP, 14 PIP, 15 DIP, 16 TIP
  // Ngón út: 17 MCP, 18 PIP, 19 DIP, 20 TIP

  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const thumbMCP = landmarks[2];

  const indexTip = landmarks[8];
  const indexPIP = landmarks[6];
  const indexMCP = landmarks[5];

  const middleTip = landmarks[12];
  const middlePIP = landmarks[10];
  const middleMCP = landmarks[9];

  const ringTip = landmarks[16];
  const ringPIP = landmarks[14];
  const ringMCP = landmarks[13];

  const pinkyTip = landmarks[20];
  const pinkyPIP = landmarks[18];
  const pinkyMCP = landmarks[17];

  // Chiều dài tham chiếu lòng bàn tay (từ cổ tay đến MCP ngón giữa)
  const palmScale = getDistance(wrist, middleMCP) || 0.1;

  // 1. Kiểm tra 4 ngón: Trỏ, Giữa, Áp út, Út
  // Một ngón được coi là duỗi thẳng (MỞ) nếu:
  // - Khoảng cách từ đầu ngón tới cổ tay xa hơn khớp PIP tới cổ tay
  // - Khoảng cách từ đầu ngón tới khớp MCP xa hơn khớp PIP tới MCP
  // - Góc mở tại khớp PIP đủ thẳng (> 135 độ)
  const checkFingerOpen = (tip, pip, mcp) => {
    const distTipToWrist = getDistance(tip, wrist);
    const distPipToWrist = getDistance(pip, wrist);
    const distTipToMcp = getDistance(tip, mcp);
    const distPipToMcp = getDistance(pip, mcp);
    const angle = getAngle(tip, pip, mcp);

    const isExtendedDist = distTipToWrist > distPipToWrist * 1.08 && distTipToMcp > distPipToMcp * 1.15;
    const isAngleStraight = angle > 130;

    return isExtendedDist || (isAngleStraight && distTipToMcp > distPipToMcp);
  };

  const isIndexOpen = checkFingerOpen(indexTip, indexPIP, indexMCP);
  const isMiddleOpen = checkFingerOpen(middleTip, middlePIP, middleMCP);
  const isRingOpen = checkFingerOpen(ringTip, ringPIP, ringMCP);
  const isPinkyOpen = checkFingerOpen(pinkyTip, pinkyPIP, pinkyMCP);

  // 2. Kiểm tra ngón cái (Thumb)
  // Ngón cái linh hoạt hơn, so sánh khoảng cách đầu ngón cái tới khớp MCP ngón út và MCP ngón trỏ
  const distThumbTipToPinky = getDistance(thumbTip, pinkyMCP);
  const distThumbIPToPinky = getDistance(thumbIP, pinkyMCP);
  const distThumbTipToIndex = getDistance(thumbTip, indexMCP);
  const thumbAngle = getAngle(thumbTip, thumbIP, thumbMCP);

  // Ngón cái mở ra khi đầu ngón cái vươn xa khỏi gốc ngón út và ngón trỏ
  const isThumbOpen = (distThumbTipToPinky > distThumbIPToPinky * 1.15 && distThumbTipToIndex > palmScale * 0.35) ||
                      thumbAngle > 145;

  const fingers = {
    thumb: isThumbOpen,
    index: isIndexOpen,
    middle: isMiddleOpen,
    ring: isRingOpen,
    pinky: isPinkyOpen
  };

  // Đếm số lượng ngón đang mở
  let count = 0;
  if (isThumbOpen) count++;
  if (isIndexOpen) count++;
  if (isMiddleOpen) count++;
  if (isRingOpen) count++;
  if (isPinkyOpen) count++;

  // 3. Phân loại cử chỉ (Gesture Classification)
  let gesture = '';
  let gestureIcon = '';
  let specialDescription = '';

  // Khoảng cách đầu ngón cái đến đầu ngón trỏ (dành cho OK hoặc Tim nhỏ)
  const distThumbTipToIndexTip = getDistance(thumbTip, indexTip);

  // Dấu hiệu OK: Ngón cái chạm ngón trỏ, các ngón giữa/áp út/út mở
  const isOkSign = distThumbTipToIndexTip < palmScale * 0.35 &&
                   isMiddleOpen && isRingOpen && isPinkyOpen;

  // Dấu hiệu Like / Thumbs Up: Chỉ ngón cái mở và hướng lên trên (tip.y < mcp.y)
  const isThumbPointingUp = thumbTip.y < thumbMCP.y && thumbTip.y < wrist.y;
  const isThumbPointingDown = thumbTip.y > thumbMCP.y && thumbTip.y > wrist.y;

  if (isOkSign) {
    gesture = 'OK Sign';
    gestureIcon = '👌';
    specialDescription = 'Ký hiệu OK';
  } else if (count === 0) {
    gesture = 'Fist';
    gestureIcon = '✊';
    specialDescription = 'Nắm đấm / 0 ngón';
  } else if (count === 1) {
    if (isIndexOpen) {
      gesture = 'Pointing';
      gestureIcon = '☝️';
      specialDescription = 'Số 1 - Chỉ tay';
    } else if (isThumbOpen) {
      if (isThumbPointingUp) {
        gesture = 'Thumbs Up';
        gestureIcon = '👍';
        specialDescription = 'Số 1 - Tuyệt vời (Like)';
      } else if (isThumbPointingDown) {
        gesture = 'Thumbs Down';
        gestureIcon = '👎';
        specialDescription = 'Không thích (Dislike)';
      } else {
        gesture = 'Thumb';
        gestureIcon = '👍';
        specialDescription = 'Số 1 - Ngón cái';
      }
    } else if (isPinkyOpen) {
      gesture = 'Pinky';
      gestureIcon = '🤙';
      specialDescription = 'Số 1 - Ngón út';
    } else {
      gesture = 'One Finger';
      gestureIcon = '1️⃣';
      specialDescription = 'Số 1';
    }
  } else if (count === 2) {
    if (isIndexOpen && isMiddleOpen) {
      gesture = 'Victory / Peace';
      gestureIcon = '✌️';
      specialDescription = 'Số 2 - Chiến thắng / Chữ V';
    } else if (isThumbOpen && isIndexOpen) {
      gesture = 'Gun / L-Sign';
      gestureIcon = '👉';
      specialDescription = 'Số 2 - Hình chữ L';
    } else if (isThumbOpen && isPinkyOpen) {
      gesture = 'Call Me / Shaka';
      gestureIcon = '🤙';
      specialDescription = 'Số 2 - Cử chỉ Gọi điện';
    } else {
      gesture = 'Two Fingers';
      gestureIcon = '2️⃣';
      specialDescription = 'Số 2';
    }
  } else if (count === 3) {
    if (isIndexOpen && isMiddleOpen && isRingOpen) {
      gesture = 'Three Fingers';
      gestureIcon = '3️⃣';
      specialDescription = 'Số 3 - Ba ngón';
    } else if (isThumbOpen && isIndexOpen && isMiddleOpen) {
      gesture = 'Three (EU style)';
      gestureIcon = '3️⃣';
      specialDescription = 'Số 3 - Kiểu mở rộng';
    } else if (isThumbOpen && isIndexOpen && isPinkyOpen) {
      gesture = 'I Love You';
      gestureIcon = '🤟';
      specialDescription = 'Số 3 - Yêu thương (Love)';
    } else if (isIndexOpen && isPinkyOpen && isThumbOpen) {
      gesture = 'Rock On';
      gestureIcon = '🤘';
      specialDescription = 'Số 3 - Rock';
    } else {
      gesture = 'Three Fingers';
      gestureIcon = '3️⃣';
      specialDescription = 'Số 3';
    }
  } else if (count === 4) {
    if (isIndexOpen && isMiddleOpen && isRingOpen && isPinkyOpen) {
      gesture = 'Four Fingers';
      gestureIcon = '4️⃣';
      specialDescription = 'Số 4 - Bốn ngón';
    } else {
      gesture = 'Four Fingers';
      gestureIcon = '4️⃣';
      specialDescription = 'Số 4';
    }
  } else if (count === 5) {
    gesture = 'Open Palm';
    gestureIcon = '🖐️';
    specialDescription = 'Số 5 - Bàn tay mở / Chào';
  }

  // Tọa độ trọng tâm bàn tay (Bounding Box & Center)
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  landmarks.forEach(p => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });

  return {
    count,
    gesture,
    gestureIcon,
    specialDescription,
    fingers,
    handedness,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    },
    bbox: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    },
    landmarks
  };
}
