export default function Price({ value }: { value: number }) {
  return <p className="listing-price">{new Intl.NumberFormat('vi-VN').format(value)} đ</p>;
}
