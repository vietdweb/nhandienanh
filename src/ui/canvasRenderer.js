/**
 * Bộ vẽ Canvas 2D chuyên dụng cho giao diện Cyberpunk AI HUD
 * Vẽ bộ khung xương người (Pose), khung xương bàn tay (Hand Skeleton),
 * góc ngắm mục tiêu (Target Brackets), và nhãn số nổi (Floating Badges).
 */

const HAND_CONNECTIONS = [
  // Lòng bàn tay
  [0, 1], [1, 2], [2, 5], [5, 9], [9, 13], [13, 17], [0, 17],
  // Ngón cái
  [2, 3], [3, 4],
  // Ngón trỏ
  [5, 6], [6, 7], [7, 8],
  // Ngón giữa
  [9, 10], [10, 11], [11, 12],
  // Ngón áp út
  [13, 14], [14, 15], [15, 16],
  // Ngón út
  [17, 18], [18, 19], [19, 20]
];

const POSE_CONNECTIONS = [
  // Thân trên
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Cánh tay trái
  [11, 13], [13, 15],
  // Cánh tay phải
  [12, 14], [14, 16],
  // Chân trái
  [23, 25], [25, 27],
  // Chân phải
  [24, 26], [26, 28]
];

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.showPose = true;
    this.showHands = true;
    this.showBoundingBoxes = true;
    this.mirror = true;
  }

  resize(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Chuyển đổi tọa độ chuẩn hóa (0..1) sang tọa độ Canvas (có tính năng lật gương)
  toCanvasCoords(point) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const x = this.mirror ? (1 - point.x) * w : point.x * w;
    const y = point.y * h;
    return { x, y };
  }

  drawFrame(visionData) {
    this.clear();
    if (!visionData) return;

    const { hands, person } = visionData;

    // 1. Vẽ nhận diện con người (Human Pose & Bounding Box)
    if (this.showPose && person && person.detected) {
      this.drawPerson(person);
    }

    // 2. Vẽ nhận diện bàn tay & cử chỉ ngón tay
    if (this.showHands && hands && hands.length > 0) {
      hands.forEach((hand, idx) => {
        this.drawHand(hand, idx);
      });
    }

    // 3. Vẽ hiệu ứng HUD Scanner viền màn hình
    this.drawHUDScanlines();
  }

  drawPerson(person) {
    const ctx = this.ctx;

    // Vẽ Bounding Box khung nhắm mục tiêu Cyberpunk
    if (this.showBoundingBoxes && person.bbox) {
      const b = person.bbox;
      const p1 = this.toCanvasCoords({ x: b.x, y: b.y });
      const p2 = this.toCanvasCoords({ x: b.x + b.width, y: b.y + b.height });

      const left = Math.min(p1.x, p2.x);
      const top = Math.min(p1.y, p2.y);
      const width = Math.abs(p2.x - p1.x);
      const height = Math.abs(p2.y - p1.y);

      // Vẽ góc ngắm mục tiêu (Target Brackets)
      const cornerSize = Math.min(30, width * 0.2, height * 0.2);
      ctx.save();
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(0, 255, 204, 0.8)';
      ctx.shadowBlur = 10;

      // Góc trên trái
      ctx.beginPath();
      ctx.moveTo(left, top + cornerSize);
      ctx.lineTo(left, top);
      ctx.lineTo(left + cornerSize, top);
      ctx.stroke();

      // Góc trên phải
      ctx.beginPath();
      ctx.moveTo(left + width - cornerSize, top);
      ctx.lineTo(left + width, top);
      ctx.lineTo(left + width, top + cornerSize);
      ctx.stroke();

      // Góc dưới trái
      ctx.beginPath();
      ctx.moveTo(left, top + height - cornerSize);
      ctx.lineTo(left, top + height);
      ctx.lineTo(left + cornerSize, top + height);
      ctx.stroke();

      // Góc dưới phải
      ctx.beginPath();
      ctx.moveTo(left + width - cornerSize, top + height);
      ctx.lineTo(left + width, top + height);
      ctx.lineTo(left + width, top + height - cornerSize);
      ctx.stroke();

      // Nhãn "CON NGƯỜI / HUMAN"
      ctx.fillStyle = 'rgba(0, 255, 204, 0.9)';
      ctx.font = 'bold 12px "Orbitron", monospace, sans-serif';
      const tagText = `👤 PHÁT HIỆN NGƯỜI [${person.confidence}%]`;
      const tagWidth = ctx.measureText(tagText).width;

      ctx.fillStyle = 'rgba(10, 25, 40, 0.85)';
      ctx.fillRect(left, Math.max(0, top - 24), tagWidth + 16, 22);
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 1;
      ctx.strokeRect(left, Math.max(0, top - 24), tagWidth + 16, 22);

      ctx.fillStyle = '#00ffcc';
      ctx.fillText(tagText, left + 8, Math.max(0, top - 24) + 15);
      ctx.restore();
    }

    // Vẽ khung xương người
    if (person.landmarks) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.45)';
      ctx.lineWidth = 2.5;

      POSE_CONNECTIONS.forEach(([i, j]) => {
        const p1 = person.landmarks[i];
        const p2 = person.landmarks[j];
        if (p1 && p2 && (p1.visibility || 1) > 0.5 && (p2.visibility || 1) > 0.5) {
          const c1 = this.toCanvasCoords(p1);
          const c2 = this.toCanvasCoords(p2);
          ctx.beginPath();
          ctx.moveTo(c1.x, c1.y);
          ctx.lineTo(c2.x, c2.y);
          ctx.stroke();
        }
      });

      // Khớp nối người
      ctx.fillStyle = '#00e5ff';
      person.landmarks.forEach((p, idx) => {
        // Chỉ vẽ các khớp chính (vai, khuỷu tay, cổ tay, hông, đầu gối)
        if ([11, 12, 13, 14, 15, 16, 23, 24, 25, 26].includes(idx)) {
          if ((p.visibility || 1) > 0.5) {
            const c = this.toCanvasCoords(p);
            ctx.beginPath();
            ctx.arc(c.x, c.y, 4, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      });
      ctx.restore();
    }
  }

  drawHand(hand, handIndex) {
    const ctx = this.ctx;
    const { landmarks, count, gestureIcon, specialDescription, fingers } = hand;
    const isPrimaryColor = handIndex === 0;
    const color = isPrimaryColor ? '#ff0055' : '#00f0ff';
    const glowColor = isPrimaryColor ? 'rgba(255, 0, 85, 0.8)' : 'rgba(0, 240, 255, 0.8)';

    // 1. Vẽ các đường nối xương bàn tay (Neon Skeleton)
    ctx.save();
    ctx.strokeStyle = isPrimaryColor ? 'rgba(255, 50, 120, 0.85)' : 'rgba(0, 230, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;

    HAND_CONNECTIONS.forEach(([i, j]) => {
      const c1 = this.toCanvasCoords(landmarks[i]);
      const c2 = this.toCanvasCoords(landmarks[j]);
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.stroke();
    });
    ctx.restore();

    // 2. Vẽ các khớp đốt ngón tay
    ctx.save();
    landmarks.forEach((pt, i) => {
      const c = this.toCanvasCoords(pt);
      const isFingertip = [4, 8, 12, 16, 20].includes(i);

      ctx.beginPath();
      if (isFingertip) {
        // Kiểm tra xem đầu ngón này có đang MỞ hay không
        let isOpen = false;
        if (i === 4) isOpen = fingers.thumb;
        if (i === 8) isOpen = fingers.index;
        if (i === 12) isOpen = fingers.middle;
        if (i === 16) isOpen = fingers.ring;
        if (i === 20) isOpen = fingers.pinky;

        ctx.arc(c.x, c.y, isOpen ? 8 : 5, 0, Math.PI * 2);
        ctx.fillStyle = isOpen ? '#00ff88' : '#ff3366';
        ctx.shadowColor = isOpen ? '#00ff88' : '#ff3366';
        ctx.shadowBlur = 15;
        ctx.fill();

        // Vẽ viền trắng nổi bật cho đầu ngón mở
        if (isOpen) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else {
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.fill();
      }
    });
    ctx.restore();

    // 3. Vẽ Bounding Box & Thẻ Huy Hiệu Số Động trên tay
    const center = this.toCanvasCoords(hand.center);
    const wrist = this.toCanvasCoords(landmarks[0]);
    const topY = Math.min(...landmarks.map(p => this.toCanvasCoords(p).y)) - 25;

    ctx.save();
    // Huy hiệu số tròn nổi phía trên bàn tay
    const badgeX = center.x;
    const badgeY = Math.max(35, topY);

    // Vòng tròn hào quang
    const grad = ctx.createRadialGradient(badgeX, badgeY, 10, badgeX, badgeY, 32);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 32, 0, Math.PI * 2);
    ctx.fill();

    // Nền huy hiệu
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Chữ số cực to trên huy hiệu
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Orbitron", monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(count.toString(), badgeX, badgeY + 1);

    // Thẻ mô tả cử chỉ bên dưới huy hiệu
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const label = `${gestureIcon} ${specialDescription || `Số ${count}`}`;
    const labelWidth = ctx.measureText(label).width + 16;
    const labelX = badgeX - labelWidth / 2;
    const labelY = badgeY + 30;

    ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
    ctx.roundRect(labelX, labelY, labelWidth, 24, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#00ffcc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, badgeX, labelY + 12);

    ctx.restore();
  }

  drawHUDScanlines() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Vẽ 4 góc HUD trang trí tổng thể
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.4)';
    ctx.lineWidth = 2;
    const len = 25;
    const pad = 15;

    // Góc trên trái
    ctx.beginPath();
    ctx.moveTo(pad, pad + len);
    ctx.lineTo(pad, pad);
    ctx.lineTo(pad + len, pad);
    ctx.stroke();

    // Góc trên phải
    ctx.beginPath();
    ctx.moveTo(w - pad - len, pad);
    ctx.lineTo(w - pad, pad);
    ctx.lineTo(w - pad, pad + len);
    ctx.stroke();

    // Góc dưới trái
    ctx.beginPath();
    ctx.moveTo(pad, h - pad - len);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(pad + len, h - pad);
    ctx.stroke();

    // Góc dưới phải
    ctx.beginPath();
    ctx.moveTo(w - pad - len, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.lineTo(w - pad, h - pad - len);
    ctx.stroke();

    ctx.restore();
  }
}
