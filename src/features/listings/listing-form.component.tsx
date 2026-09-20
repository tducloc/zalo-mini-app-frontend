import { useState, useEffect, useRef } from 'react';
import FeedbackState from '@/components/feedback-state.component';
import { categories } from '@/features/categories/categories.constants';

export type FormState =
  'default' | 'validation' | 'uploading' | 'upload-error' | 'ready' | 'success' | 'edit';
const sampleImage =
  'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=500&q=80';
export default function ListingForm({
  state = 'default',
  demo = false,
}: {
  state?: FormState;
  demo?: boolean;
}) {
  const [errors, setErrors] = useState<Record<string, string>>(
    state === 'validation'
      ? {
          category: 'Vui lòng chọn danh mục.',
          title: 'Nhập tiêu đề từ 3 đến 120 ký tự.',
          description: 'Mô tả cần từ 10 đến 5.000 ký tự.',
          price: 'Nhập giá nguyên dương bằng VNĐ.',
          condition: 'Vui lòng chọn tình trạng.',
          location: 'Vui lòng điền địa điểm.',
          main: 'Vui lòng chọn ảnh chính.',
        }
      : {},
  );
  const [done, setDone] = useState(state === 'success');
  const [main, setMain] = useState<string | null>(
    ['ready', 'edit', 'uploading', 'upload-error'].includes(state) ? sampleImage : null,
  );
  const [gallery, setGallery] = useState<string[]>(
    ['ready', 'edit', 'uploading', 'upload-error'].includes(state)
      ? [sampleImage, sampleImage]
      : [],
  );
  const [retrying, setRetrying] = useState(false);
  const createdUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      createdUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const choose = (files: FileList | null, cover: boolean) => {
    if (!files?.length) return;
    const chosen = Array.from(files);
    if (chosen.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setErrors({ ...errors, main: 'Chọn ảnh JPG, PNG hoặc WebP.' });
      return;
    }
    if (!cover && gallery.length + chosen.length > 9) {
      setErrors({ ...errors, gallery: 'Tối đa 10 ảnh tổng cộng theo API hiện tại.' });
      return;
    }
    const urls = chosen.map((file) => URL.createObjectURL(file));
    createdUrls.current.push(...urls);
    if (cover) setMain(urls[0]);
    else setGallery([...gallery, ...urls]);
    setErrors({});
  };
  if (done)
    return (
      <FeedbackState
        type="success"
        title="Tin của bạn đã được đăng"
        description="Bạn có thể theo dõi và cập nhật tin trong Quản lý tin."
        actionLabel="Quay lại form"
        onRetry={() => setDone(false)}
      />
    );
  return (
    <form
      className="listing-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const next: Record<string, string> = {};
        const title = String(data.get('title') || '').trim();
        const description = String(data.get('description') || '').trim();
        if (title.length < 3 || title.length > 120) next.title = 'Tiêu đề cần từ 3 đến 120 ký tự.';
        if (description.length < 10 || description.length > 5000)
          next.description = 'Mô tả cần từ 10 đến 5.000 ký tự.';
        if (!Number.isInteger(Number(data.get('price'))) || Number(data.get('price')) <= 0)
          next.price = 'Nhập giá nguyên dương bằng VNĐ.';
        for (const field of ['category', 'condition', 'location'])
          if (!String(data.get(field) || '').trim()) next[field] = 'Vui lòng điền thông tin này.';
        if (!main) next.main = 'Vui lòng chọn ảnh chính.';
        setErrors(next);
        if (!Object.keys(next).length && demo) setDone(true);
      }}
    >
      <section className="form-section">
        <h2>Hình ảnh sản phẩm</h2>
        <p className="ui-muted">Ảnh rõ nét giúp người mua hiểu sản phẩm hơn.</p>
        <div className="field-heading">
          <b>
            Ảnh chính <em>*</em>
          </b>
          <span>Ảnh trên thẻ tin</span>
        </div>
        <label className={`cover-picker ${errors.main ? 'invalid' : ''}`}>
          {main ? (
            <>
              <img src={main} alt="Ảnh chính đã chọn" />
              {state === 'uploading' && (
                <span className="image-transfer image-transfer-loading" role="status">
                  <i aria-hidden="true" />
                  <b>Đang tải ảnh</b>
                </span>
              )}
            </>
          ) : (
            <span className="upload-plus">+</span>
          )}
          <span>
            {main ? 'Thay ảnh chính' : 'Chọn 1 ảnh chính'}
            <small>JPG, PNG hoặc WebP</small>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Chọn ảnh chính"
            onChange={(e) => choose(e.target.files, true)}
          />
        </label>
        {errors.main && <p className="field-error">{errors.main}</p>}
        <div className="field-heading">
          <b>Thư viện ảnh</b>
          <span>Tùy chọn · {gallery.length} ảnh</span>
        </div>
        <div className="gallery-picker">
          {gallery.map((url, i) => {
            const isUploading = state === 'uploading' && i === 0;
            const hasUploadError = state === 'upload-error' && i === 1 && !retrying;
            return (
              <div className="gallery-item" key={`${url}-${i}`}>
                <img src={url} alt={`Ảnh gallery ${i + 1}`} />
                {isUploading ? (
                  <span className="image-transfer image-transfer-loading" role="status">
                    <i aria-hidden="true" />
                    <b>Đang tải</b>
                  </span>
                ) : hasUploadError ? (
                  <span className="image-transfer image-transfer-error" role="status">
                    <b>Tải ảnh lỗi</b>
                    <button type="button" onClick={() => setRetrying(true)}>
                      Thử lại
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Xóa ảnh ${i + 1}`}
                    onClick={() => setGallery(gallery.filter((_, idx) => idx !== i))}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
          {gallery.length < 9 && (
            <label className="gallery-add">
              +<small>Thêm ảnh</small>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                aria-label="Thêm ảnh gallery"
                onChange={(e) => choose(e.target.files, false)}
              />
            </label>
          )}
        </div>
        <p className="ui-muted">Ảnh bổ sung hiển thị trong chi tiết tin.</p>
        {errors.gallery && <p className="field-error">{errors.gallery}</p>}
        {retrying && (
          <p className="ui-muted" role="status">
            Đang tải lại ảnh thứ 2…
          </p>
        )}
      </section>
      <section className="form-section">
        <h2>Thông tin tin đăng</h2>
        <label className="ui-field">
          Danh mục <em>*</em>
          <select
            name="category"
            aria-invalid={!!errors.category}
            defaultValue={state === 'edit' ? 'cat_electronics' : ''}
          >
            <option value="">Chọn danh mục</option>
            {categories.map((c) => (
              <option disabled={c.id === 'cat_others'} key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {errors.category && <small className="field-error">{errors.category}</small>}
        </label>
        <label className="ui-field">
          Tiêu đề <em>*</em>
          <input
            name="title"
            maxLength={120}
            defaultValue={state === 'edit' ? 'iPhone 13 128GB' : ''}
            placeholder="Ví dụ: iPhone 13 128GB còn đẹp"
            aria-invalid={!!errors.title}
          />
          <small className={errors.title ? 'field-error' : 'ui-muted'}>
            {errors.title || 'Từ 3 đến 120 ký tự'}
          </small>
        </label>
        <label className="ui-field">
          Mô tả <em>*</em>
          <textarea
            name="description"
            rows={4}
            maxLength={5000}
            defaultValue={state === 'edit' ? 'Máy sử dụng tốt, còn đầy đủ phụ kiện.' : ''}
            placeholder="Tình trạng, phụ kiện đi kèm, lý do bán…"
            aria-invalid={!!errors.description}
          />
          <small className={errors.description ? 'field-error' : 'ui-muted'}>
            {errors.description || 'Từ 10 đến 5.000 ký tự'}
          </small>
        </label>
        <label className="ui-field">
          Giá bán (VNĐ) <em>*</em>
          <input
            name="price"
            inputMode="numeric"
            type="number"
            min={1}
            step={1}
            defaultValue={state === 'edit' ? 6990000 : undefined}
            placeholder="Nhập giá bán"
            aria-invalid={!!errors.price}
          />
          {errors.price && <small className="field-error">{errors.price}</small>}
        </label>
        <fieldset className={`condition-field ${errors.condition ? 'invalid' : ''}`}>
          <legend>
            Tình trạng <em>*</em>
          </legend>
          {[
            ['NEW', 'Mới'],
            ['LIKE_NEW', 'Như mới'],
            ['USED', 'Đã dùng'],
          ].map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="condition"
                value={value}
                defaultChecked={state === 'edit' && value === 'LIKE_NEW'}
              />
              <span>{label}</span>
            </label>
          ))}
          {errors.condition && <small className="field-error">{errors.condition}</small>}
        </fieldset>
        <label className="ui-field">
          Địa điểm <em>*</em>
          <input
            name="location"
            defaultValue={state === 'edit' ? 'Hà Nội' : ''}
            placeholder="Ví dụ: Cầu Giấy, Hà Nội"
            aria-invalid={!!errors.location}
          />
          {errors.location && <small className="field-error">{errors.location}</small>}
        </label>
      </section>
      <div className="form-actions">
        <button className="ui-button" type="submit" disabled={!demo || state === 'uploading'}>
          {state === 'uploading' ? 'Đang tải ảnh…' : state === 'edit' ? 'Lưu thay đổi' : 'Đăng tin'}
        </button>
        {!demo && <p className="ui-muted">Chức năng gửi tin sẽ mở khi API được tích hợp.</p>}
      </div>
    </form>
  );
}
