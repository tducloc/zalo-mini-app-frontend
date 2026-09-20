import { useState } from 'react';
import { Button, Sheet } from 'zmp-ui';

import { ReportReason } from './product-report.api';

const reasons: Array<{ value: ReportReason; label: string }> = [
  { value: 'SCAM', label: 'Nghi ngờ lừa đảo' },
  { value: 'MISLEADING', label: 'Thông tin không chính xác' },
  { value: 'PROHIBITED_ITEM', label: 'Sản phẩm không được phép' },
  { value: 'SPAM', label: 'Spam hoặc trùng lặp' },
  { value: 'OTHER', label: 'Lý do khác' },
];

export default function ProductReportSheet({
  visible,
  isPending,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: { reason: ReportReason; description?: string }) => void;
}) {
  const [reason, setReason] = useState<ReportReason>('SCAM');
  const [description, setDescription] = useState('');

  return (
    <Sheet visible={visible} title="Báo cáo tin đăng" autoHeight unmountOnClose onClose={onClose}>
      <form
        className="product-report-sheet"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ reason, description: description.trim() || undefined });
        }}
      >
        <p>Chọn lý do phù hợp. Mỗi tài khoản chỉ có thể báo cáo một lần cho mỗi tin.</p>
        <div className="product-report-reasons">
          {reasons.map((item) => (
            <label key={item.value}>
              <input
                checked={reason === item.value}
                name="report-reason"
                type="radio"
                value={item.value}
                onChange={() => setReason(item.value)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        <textarea
          maxLength={1000}
          placeholder="Bổ sung chi tiết (không bắt buộc)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Button fullWidth disabled={isPending} htmlType="submit">
          {isPending ? 'Đang gửi…' : 'Gửi báo cáo'}
        </Button>
      </form>
    </Sheet>
  );
}
