import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { analyzeHand } from './fingerCounter.js';

export class VisionManager {
  constructor() {
    this.handLandmarker = null;
    this.poseLandmarker = null;
    this.isReady = false;
    this.lastVideoTime = -1;
    this.isLoading = false;
    this.error = null;
    this.enablePose = true;
    this.enableHands = true;
  }

  async init(onProgress = () => {}) {
    if (this.isReady || this.isLoading) return;
    this.isLoading = true;

    try {
      onProgress('Đang nạp bộ xử lý WebAssembly...');
      // Nạp FilesetResolver từ /wasm cục bộ hoặc CDN fallback
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks('/wasm');
      } catch (wasmErr) {
        console.warn('Wasm cục bộ không nạp được, chuyển sang CDN:', wasmErr);
        vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );
      }

      onProgress('Đang tải mô hình nhận diện Bàn tay (HandLandmarker)...');
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/models/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      onProgress('Đang tải mô hình nhận diện Con người (PoseLandmarker)...');
      try {
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/pose_landmarker_lite.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numPoses: 2,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
      } catch (poseErr) {
        console.warn('Không thể nạp mô hình PoseLandmarker GPU, thử CPU delegate:', poseErr);
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/pose_landmarker_lite.task',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numPoses: 2
        });
      }

      this.isReady = true;
      this.isLoading = false;
      onProgress('Hệ thống Vision AI sẵn sàng!');
    } catch (err) {
      this.isLoading = false;
      this.error = err;
      console.error('Lỗi khởi tạo VisionManager:', err);
      throw err;
    }
  }

  processVideoFrame(videoElement, timestamp) {
    if (!this.isReady || !videoElement || videoElement.readyState < 2) {
      return null;
    }

    // Không xử lý nếu cùng 1 frame thời gian
    if (videoElement.currentTime === this.lastVideoTime) {
      return null;
    }
    this.lastVideoTime = videoElement.currentTime;

    const startTime = performance.now();
    const result = {
      hands: [],
      totalFingers: 0,
      person: {
        detected: false,
        count: 0,
        confidence: 0,
        bbox: null,
        landmarks: null
      },
      inferenceTimeMs: 0
    };

    // 1. Nhận diện Bàn tay & Cử chỉ ngón tay
    if (this.enableHands && this.handLandmarker) {
      const handResults = this.handLandmarker.detectForVideo(videoElement, timestamp);
      if (handResults && handResults.landmarks && handResults.landmarks.length > 0) {
        let total = 0;
        handResults.landmarks.forEach((landmarks, index) => {
          let handedness = 'Hand';
          if (handResults.handednesses && handResults.handednesses[index] && handResults.handednesses[index][0]) {
            handedness = handResults.handednesses[index][0].displayName || handResults.handednesses[index][0].categoryName;
          }
          const handData = analyzeHand(landmarks, handedness);
          if (handData) {
            result.hands.push(handData);
            total += handData.count;
          }
        });
        result.totalFingers = total;
      }
    }

    // 2. Nhận diện Con người (Human / Pose Detection)
    if (this.enablePose && this.poseLandmarker) {
      const poseResults = this.poseLandmarker.detectForVideo(videoElement, timestamp);
      if (poseResults && poseResults.landmarks && poseResults.landmarks.length > 0) {
        result.person.detected = true;
        result.person.count = poseResults.landmarks.length;

        // Lấy thông tin người nổi bật nhất (người thứ nhất)
        const firstPose = poseResults.landmarks[0];
        result.person.landmarks = firstPose;

        // Tính Bounding Box quanh cơ thể người
        let minX = 1, maxX = 0, minY = 1, maxY = 0, confSum = 0;
        firstPose.forEach(p => {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
          confSum += (p.visibility !== undefined ? p.visibility : 1);
        });

        // Thêm lề (padding) 5%
        const padX = (maxX - minX) * 0.05;
        const padY = (maxY - minY) * 0.05;
        result.person.bbox = {
          x: Math.max(0, minX - padX),
          y: Math.max(0, minY - padY),
          width: Math.min(1, (maxX - minX) + padX * 2),
          height: Math.min(1, (maxY - minY) + padY * 2)
        };
        result.person.confidence = Math.round((confSum / firstPose.length) * 100);
      }
    }

    result.inferenceTimeMs = Math.round(performance.now() - startTime);
    return result;
  }
}
