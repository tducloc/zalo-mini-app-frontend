import { FormEvent, useState } from 'react';
import { Button } from 'zmp-ui';

import AppSheet from '@/components/app-sheet';

import type { CreateReportInput, ReportReason } from '../types';

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
  onSubmit: (input: CreateReportInput) => void;
}) {
  // AppSheet remounts the form per opening, resetting reason and description.
  return (
    <AppSheet visible={visible} title="Báo cáo tin đăng" autoHeight onClose={onClose}>
      <ReportForm isPending={isPending} onSubmit={onSubmit} />
    </AppSheet>
  );
}

function ReportForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (input: CreateReportInput) => void;
}) {
  // No default: a one-tap submit must not file the most serious reason.
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);

  const isReasonMissing = hasTriedSubmit && !reason;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setHasTriedSubmit(true);
    if (!reason) {
      return;
    }
    onSubmit({ reason, description: description.trim() || undefined });
  };

  return (
    <form className="product-report-sheet" noValidate onSubmit={handleSubmit}>
      <p>Chọn lý do phù hợp. Mỗi tài khoản chỉ có thể báo cáo một lần cho mỗi tin.</p>
      <div
        aria-describedby={isReasonMissing ? 'report-reason-error' : undefined}
        aria-invalid={isReasonMissing}
        aria-label="Lý do báo cáo"
        className="product-report-reasons"
        role="radiogroup"
      >
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
      {isReasonMissing && (
        <p className="m-0 text-caption text-marketplace-danger" id="report-reason-error">
          Vui lòng chọn lý do báo cáo.
        </p>
      )}
      <textarea
        maxLength={1000}
        placeholder="Bổ sung chi tiết (không bắt buộc)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      {/* Enabled until the first submit; then held until a reason is chosen. */}
      <Button fullWidth disabled={isPending || isReasonMissing} htmlType="submit">
        {isPending ? 'Đang gửi…' : 'Gửi báo cáo'}
      </Button>
    </form>
  );
}
