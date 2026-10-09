import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';

import CreateListingForm from '@/features/listings/components/form/create-listing-form';
import { EMPTY_FIELDS } from '@/features/listings/constants/listing-fields';
import { postMessages } from '@/features/listings/constants/messages';
import { DraftMediaStatus, type DraftMedia } from '@/features/listings/types/draft-media';
import { newDraftMedia } from '@/features/listings/utils/draft-media';
import { MediaKind } from '@/features/media/types/media';
import { ServerMediaStatus } from '@/features/media/types/upload';
import { http } from '@/lib/http';
import { apiClient } from '@/lib/api-client';
import { useListingDraftStore } from '@/stores/listing-draft';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), openSnackbar: vi.fn() }));

vi.mock('zmp-ui', () => ({
  Icon: () => null,
  Modal: () => null,
  useNavigate: () => mocks.navigate,
  useSnackbar: () => ({ openSnackbar: mocks.openSnackbar }),
}));
vi.mock('@/utils/dev-log', () => ({ warnInDev: vi.fn() }));
vi.mock('zmp-sdk', () => ({ getSystemInfo: vi.fn() }));
// The API is the boundary: `POST /products` is answered by the test, and the lists the
// form's selects take come from `apiClient`.
vi.mock('@/lib/http', () => ({ http: { post: vi.fn(), delete: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), defaults: {} } }));

const CATEGORIES = [{ id: 'cat_electronics', name: 'Electronics', slug: 'electronics' }];
const LOCATIONS = [
  { id: 'loc_hanoi', code: 'HN', name: 'Hà Nội' },
  { id: 'loc_danang', code: 'DN', name: 'Đà Nẵng' },
];

const PRICE_MESSAGE = 'Vui lòng nhập giá bán là số đồng lớn hơn 0, ví dụ 150.000.';
const LOCATION_MESSAGE = 'Vui lòng chọn địa điểm.';
const PRICE_LABEL = 'Giá bán (VNĐ)';

const post = vi.mocked(http.post);

/** The form's `POST /products` refused with `status` and the API's error envelope. */
function apiError(status: number, details?: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('request failed', 'ERR_BAD_REQUEST', config, undefined, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { error: { code: 'ANY', message: 'Mocked.', details } },
  });
}

/** A photo that finished uploading, as the draft holds it. */
function uploadedPhoto(name: string): DraftMedia {
  return {
    ...newDraftMedia(name, MediaKind.Image, new File(['x'], `${name}.jpg`)),
    status: DraftMediaStatus.Uploaded,
    mediaId: `media-${name}`,
    previewUrl: `https://preview.test/${name}.jpg`,
    server: { status: ServerMediaStatus.Ready, thumbnailUrl: null, error: null },
  };
}

const addToDraft = (...media: DraftMedia[]) =>
  act(() => useListingDraftStore.getState().addMedia(media));

const form = () => screen.getByRole('form', { name: 'Tin đăng mới' });
// Required fields end their label with an asterisk.
const field = (label: string) =>
  within(form()).getByLabelText((content) => content.trim().startsWith(label));
const postButton = () => within(form()).getByRole('button', { name: /^Đăng tin$|^Đang đăng…$/ });
const isDisabled = (element: HTMLElement) => element.matches(':disabled');
const workingNote = () =>
  screen.queryAllByRole('status').find((note) => note.textContent === postMessages.working);
const messageCount = (message: string) => screen.queryAllByText(message).length;

async function fillFields() {
  await userEvent.selectOptions(field('Danh mục'), 'Điện tử');
  await userEvent.type(field('Tiêu đề'), 'iPhone 13 128GB');
  await userEvent.type(field('Mô tả'), 'Máy dùng tốt, pin 90%, đủ hộp và cáp.');
  await userEvent.type(field(PRICE_LABEL), '6990000');
  await userEvent.click(field('Như mới'));
  await userEvent.selectOptions(field('Địa điểm'), 'Hà Nội');
}

/** The form with its lists loaded, on a draft with `media` already uploaded. */
async function renderForm(...media: DraftMedia[]) {
  addToDraft(...media);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <CreateListingForm />
    </QueryClientProvider>,
  );
  await screen.findByRole('option', { name: 'Hà Nội' });
  await screen.findByRole('option', { name: 'Điện tử' });
}

beforeEach(() => {
  // jsdom has no layout, so no scrolling.
  Element.prototype.scrollIntoView = vi.fn();
  URL.revokeObjectURL = vi.fn();
  vi.mocked(apiClient.get).mockImplementation((url: string) =>
    Promise.resolve({ data: { data: url === '/categories' ? CATEGORIES : LOCATIONS } }),
  );
  post.mockReset();
  mocks.navigate.mockReset();
  mocks.openSnackbar.mockReset();
  useListingDraftStore.getState().reset();
});

afterEach(cleanup);

describe('the sell form', () => {
  it('shows every missing field on the first tap, then keeps Post disabled until fixed', async () => {
    await renderForm();

    expect(isDisabled(postButton())).toBe(false);
    await userEvent.click(postButton());

    for (const message of [
      'Vui lòng chọn danh mục.',
      'Vui lòng nhập tiêu đề từ 3 đến 120 ký tự.',
      'Vui lòng nhập mô tả từ 10 đến 5.000 ký tự.',
      PRICE_MESSAGE,
      'Vui lòng chọn tình trạng.',
      LOCATION_MESSAGE,
    ]) {
      // Exactly one message per field.
      expect(messageCount(message)).toBe(1);
    }
    expect(screen.getByText(/^Vui lòng thêm ít nhất 1 ảnh/)).toBeTruthy();
    expect(isDisabled(postButton())).toBe(true);

    // Only digits stay, so what the seller sees is what posts; 0 is still refused.
    await userEvent.type(field(PRICE_LABEL), '1.5');
    expect((field(PRICE_LABEL) as HTMLInputElement).value).toBe('15');
    await userEvent.clear(field(PRICE_LABEL));
    await userEvent.type(field(PRICE_LABEL), '0');
    expect(messageCount(PRICE_MESSAGE)).toBe(1);

    addToDraft(uploadedPhoto('a'));
    await userEvent.clear(field(PRICE_LABEL));
    await fillFields();
    expect((field(PRICE_LABEL) as HTMLInputElement).value).toBe('6.990.000');
    expect(isDisabled(postButton())).toBe(false);
    expect(screen.queryAllByText(/^Vui lòng/)).toHaveLength(0);
  });

  it('keeps Post disabled while files upload, and says why', async () => {
    const uploading: DraftMedia = {
      ...uploadedPhoto('a'),
      status: DraftMediaStatus.Uploading,
      mediaId: null,
      progress: 0.3,
    };
    await renderForm(uploading);
    await fillFields();

    expect(isDisabled(postButton())).toBe(true);
    expect(workingNote()).toBeTruthy();

    act(() =>
      useListingDraftStore
        .getState()
        .updateMedia('a', { status: DraftMediaStatus.Uploaded, mediaId: 'media-a' }),
    );

    expect(isDisabled(postButton())).toBe(false);
    expect(workingNote()).toBeUndefined();
  });

  it('marks the fields the server refused (400)', async () => {
    await renderForm(uploadedPhoto('a'));
    await fillFields();
    post.mockRejectedValueOnce(apiError(400, [{ field: 'price' }, { field: 'locationId' }]));

    await userEvent.click(postButton());

    expect(await screen.findByText(PRICE_MESSAGE)).toBeTruthy();
    expect(screen.getByText(LOCATION_MESSAGE)).toBeTruthy();
    expect(field(PRICE_LABEL).getAttribute('aria-invalid')).toBe('true');
    expect(mocks.openSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ text: postMessages.fields }),
    );
    expect(screen.getByRole('heading', { name: 'Hình ảnh sản phẩm' })).toBeTruthy();

    // Disabled until every field the server refused has been changed.
    expect(isDisabled(postButton())).toBe(true);
    await userEvent.clear(field(PRICE_LABEL));
    await userEvent.type(field(PRICE_LABEL), '7000000');
    expect(isDisabled(postButton())).toBe(true);
    await userEvent.selectOptions(field('Địa điểm'), 'Đà Nẵng');
    expect(screen.queryAllByText(/^Vui lòng/)).toHaveLength(0);
    expect(isDisabled(postButton())).toBe(false);
  });

  it('marks the files the server cannot use (409), keeping the draft', async () => {
    await renderForm(uploadedPhoto('a'), uploadedPhoto('b'));
    await fillFields();
    // The server refuses the second photo.
    post.mockRejectedValueOnce(apiError(409, [{ mediaId: 'media-b', reason: 'NOT_FOUND' }]));

    await userEvent.click(postButton());

    expect(await screen.findByRole('button', { name: /^Ảnh 2, có lỗi\./ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Ảnh 1, đã sẵn sàng\./ })).toBeTruthy();
    expect(mocks.openSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ text: postMessages.mediaConflict }),
    );
    expect(isDisabled(postButton())).toBe(true);
    expect((field('Tiêu đề') as HTMLInputElement).value).toBe('iPhone 13 128GB');

    // Without it, the listing goes.
    await userEvent.click(screen.getByRole('button', { name: 'Xoá Ảnh 2' }));
    expect(isDisabled(postButton())).toBe(false);
  });

  it('opens the listing a reused key already made (422)', async () => {
    await renderForm(uploadedPhoto('a'));
    await fillFields();
    const { idempotencyKey } = useListingDraftStore.getState();
    post.mockRejectedValueOnce(apiError(422, { productId: 'prd_existing' }));

    await userEvent.click(postButton());

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/products/prd_existing', { replace: true }),
    );
    expect(mocks.openSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ text: postMessages.alreadyPosted }),
    );

    // The next draft starts empty, with a key of its own.
    const next = useListingDraftStore.getState();
    expect(next.fields).toEqual(EMPTY_FIELDS);
    expect(next.media).toEqual([]);
    expect(next.idempotencyKey).not.toBe(idempotencyKey);
  });

  it('disables the draft while the post is on its way, then opens My listings', async () => {
    await renderForm(uploadedPhoto('a'), uploadedPhoto('b'));
    await fillFields();
    let answer: (response: { data: { data: { id: string; status: string } } }) => void = () => {};
    post.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

    await userEvent.click(postButton());

    const sending = within(form()).getByRole('button', { name: 'Đang đăng…' });
    expect(isDisabled(sending)).toBe(true);
    expect(isDisabled(screen.getByRole('button', { name: 'Xoá Ảnh 1' }))).toBe(true);
    expect(isDisabled(field('Thêm ảnh'))).toBe(true);
    expect(isDisabled(field('Tiêu đề'))).toBe(true);
    expect(mocks.navigate).not.toHaveBeenCalled();

    answer({ data: { data: { id: 'prd_new', status: 'PUBLISHED' } } });

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/my-listings', { replace: true }),
    );
  });
});
