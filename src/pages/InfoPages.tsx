import { PixelPanel } from "../components/ui/PixelPanel";

export function AboutPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 p-8 text-2xl leading-snug">
      <h1 className="font-vi text-[28px] text-gold">NGUỒN DỮ LIỆU</h1>
      <PixelPanel className="flex flex-col gap-3">
        <p>
          Danh sách từ ở các bộ A1 và A2 được chọn theo mức độ CEFR của danh sách từ phổ biến. Chỉ
          từ gốc và cấp độ được dùng; nghĩa tiếng Việt do máy dịch và đang chờ duyệt thủ công.
        </p>
        <p>
          Phiên âm IPA lấy từ <a href="https://en.wiktionary.org/">Wiktionary</a> (giấy phép CC
          BY-SA), qua bản trích xuất của <a href="https://kaikki.org/">kaikki.org</a>.
        </p>
        <p>Nếu bạn thấy nghĩa chưa đúng, hãy báo cho chúng tôi để sửa.</p>
      </PixelPanel>
    </main>
  );
}

export function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 p-8 text-2xl leading-snug">
      <h1 className="font-vi text-[28px] text-gold">QUYỀN RIÊNG TƯ</h1>
      <PixelPanel className="flex flex-col gap-3">
        <p>
          <b>Khách:</b> không lưu gì trên máy chủ. Cài đặt (âm thanh, độ khó…) chỉ nằm trong trình
          duyệt của bạn.
        </p>
        <p>
          <b>Đăng nhập bằng Google:</b> chúng tôi lưu email, tên và ảnh đại diện Google cấp, cùng
          tiến độ học (điểm, sao, từ đã học, nhiệm vụ). Dữ liệu dùng để hiển thị hồ sơ và bảng xếp
          hạng.
        </p>
        <p>
          Chúng tôi không bán dữ liệu và không dùng quảng cáo. Muốn xoá tài khoản, hãy liên hệ để
          được xoá toàn bộ dữ liệu.
        </p>
      </PixelPanel>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <main className="flex flex-col items-center gap-4 p-16 text-center">
      <h1 className="font-px text-2xl text-gold">404</h1>
      <p className="text-3xl">Trang này không tồn tại.</p>
    </main>
  );
}
