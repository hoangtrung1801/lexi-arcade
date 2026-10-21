import { PixelPanel } from "../components/ui/PixelPanel";

export function AboutPage() {
  return (
    <main className="t-md mx-auto flex max-w-3xl flex-col gap-5 p-8">
      <h1 className="t-lg t-bold text-gold uppercase">Nguồn dữ liệu</h1>
      <PixelPanel className="flex flex-col gap-3 text-haze [&_a]:text-gold [&_a:hover]:text-snow [&_b]:text-snow">
        <p>
          Danh sách từ ở các bộ A1 và A2 được chọn theo mức độ CEFR của danh sách từ phổ biến. Chỉ
          từ gốc và cấp độ được dùng; nghĩa tiếng Việt do máy dịch và đang chờ duyệt thủ công.
        </p>
        <p>
          Phiên âm IPA lấy từ <a href="https://en.wiktionary.org/">Wiktionary</a> (giấy phép CC
          BY-SA), qua bản trích xuất của <a href="https://kaikki.org/">kaikki.org</a>.
        </p>
        <p>
          Phông chữ pixel <a href="https://github.com/quiple/galmuri">Galmuri</a> của Lee Minseo
          (giấy phép SIL Open Font License 1.1).
        </p>
        <p>Nếu bạn thấy nghĩa chưa đúng, hãy báo cho chúng tôi để sửa.</p>
      </PixelPanel>
    </main>
  );
}

export function PrivacyPage() {
  return (
    <main className="t-md mx-auto flex max-w-3xl flex-col gap-5 p-8">
      <h1 className="t-lg t-bold text-gold uppercase">Quyền riêng tư</h1>
      <PixelPanel className="flex flex-col gap-3 text-haze [&_a]:text-gold [&_a:hover]:text-snow [&_b]:text-snow">
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
      <h1 className="font-px t-gold text-[144px] leading-[144px]">404</h1>
      <p className="t-md text-haze">Trang này không tồn tại.</p>
    </main>
  );
}
