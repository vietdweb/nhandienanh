# Ứng Dụng Web Camera AI: Nhận Diện Người & Đếm Ngón Tay (0 - 5)

Dự án ứng dụng web AI Vision hiện đại, sử dụng **Google MediaPipe Tasks Vision**, **HTML5 Canvas 2D** và **Vite**, có khả năng:
- **Nhận diện con người trong khung hình** theo thời gian thực (vẽ khung ngắm Cyberpunk HUD, khung xương cơ thể 33 điểm mốc, đo độ tin cậy).
- **Nhận diện bàn tay & Đếm chính xác số ngón tay giơ lên (1, 2, 3, 4, 5)** cùng các cử chỉ đặc biệt (nắm tay 0 ngón, Thumbs Up/Like 👍, Chữ V/Peace ✌️, OK 👌, Love 🤟, Spiderman/Rock 🤘...).
- **Hiển thị số ngón tay cực lớn và hiệu ứng động (Dynamic Pulse)** trên màn hình.
- **Phát âm thanh & Đọc số tiếng Việt** ("Một", "Hai", "Ba", "Bốn", "Năm"...) qua Web Speech API khi người dùng giữ ổn định ngón tay.
- **Trò chơi phản xạ ngón tay (Interactive Mini Game)**: Thử thách người dùng giơ đúng số ngón tay theo yêu cầu ngẫu nhiên của AI trong thời gian đếm ngược.
- **Chế độ Demo Giả lập**: Cho phép trải nghiệm trọn vẹn thuật toán và giao diện ngay cả trên thiết bị chưa có hoặc chưa cấp quyền camera.

---

## 🚀 Hướng Dẫn Khởi Chạy Nhanh

### 1. Khởi động Dev Server
Mở terminal tại thư mục dự án và chạy:

```bash
npm run dev
```

Sau khi chạy lệnh, Vite sẽ khởi động local server tại địa chỉ:
👉 **`http://localhost:5173`** (hoặc `http://127.0.0.1:5173`)

### 2. Sử dụng trên trình duyệt
1. Mở trình duyệt Chrome, Edge, Brave hoặc Cốc Cốc và truy cập đường link trên.
2. Khi trình duyệt hiện hộp thoại thông báo hỏi quyền truy cập:
   - Chọn **"Allow" / "Cho phép"** để hệ thống kết nối Webcam.
3. Giơ bàn tay trước camera:
   - Giơ **1 ngón**: Màn hình hiện số **1** (kèm mô tả Chỉ ngón trỏ hoặc Like).
   - Giơ **2 ngón**: Màn hình hiện số **2** (kèm biểu tượng Chữ V / Peace).
   - Giơ **3 ngón**: Màn hình hiện số **3**.
   - Giơ **4 ngón**: Màn hình hiện số **4**.
   - Giơ **5 ngón**: Màn hình hiện số **5** (Bàn tay mở / Chào).
   - Nắm chặt tay: Màn hình hiện số **0** (Nắm đấm / Fist).

---

## 🛠️ Các Tính Năng Trên Thanh Công Cụ (HUD Controls)

- **📹 Camera: Bật / Tắt**: Tạm dừng hoặc kích hoạt lại luồng video webcam.
- **🪞 Gương: Bật / Tắt**: Lật gương video để chuyển động tay tự nhiên như soi gương.
- **🦴 Khung xương: Bật / Tắt**: Bật hoặc ẩn mạng lưới 21 điểm mốc laser của bàn tay.
- **👤 Khung Người: Bật / Tắt**: Bật hoặc ẩn khung định vị và khung xương cơ thể người.
- **🔊 Giọng đọc: Bật / Tắt**: Bật/tắt đọc số tiếng Việt và hiệu ứng âm thanh Synthesizer.
- **📸 Chụp ảnh**: Chụp và tải về ảnh khung hình khoảnh khắc kèm lớp phủ HUD công nghệ cao dạng PNG.
- **✨ Demo Giả lập**: Chạy thử chu trình nhận diện 0 -> 1 -> 2 -> 3 -> 4 -> 5 tự động mà không cần camera.
- **🎮 Trò chơi phản xạ**: Bấm "Chơi ngay" trên bảng bên phải để bắt đầu trò chơi thách đố ngón tay tích điểm.

---

## 📂 Cấu Trúc Dự Án

```
nhandienanh/
├── index.html                 # Giao diện chính HUD Cyberpunk
├── vite.config.js             # Cấu hình Vite Dev Server
├── package.json               # Cấu hình dự án và dependencies
├── public/
│   ├── models/                # Mô hình MediaPipe tải sẵn chạy offline
│   │   ├── hand_landmarker.task
│   │   └── pose_landmarker_lite.task
│   └── wasm/                  # Tệp WebAssembly nhúng sẵn
├── src/
│   ├── main.js                # Vòng lặp chính, kết nối camera & giao diện
│   ├── style.css              # Hệ thống style Cyberpunk HUD hiện đại
│   ├── ai/
│   │   ├── visionManager.js   # Quản lý MediaPipe Vision pipeline
│   │   └── fingerCounter.js   # Thuật toán phân tích hình học 21 khớp ngón tay
│   ├── ui/
│   │   └── canvasRenderer.js  # Vẽ khung xương, hiệu ứng neon glow trên Canvas
│   └── audio/
│       └── soundManager.js    # Hiệu ứng âm thanh & đọc số tiếng Việt
└── README.md
```
