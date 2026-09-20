export type MediaType = 'IMAGE' | 'VIDEO';

export type ProductDetail = {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: 'NEW' | 'LIKE_NEW' | 'USED';
  status: 'PROCESSING' | 'PUBLISHED' | 'SOLD' | 'ARCHIVED';
  location: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  media: Array<{
    id: string;
    role: 'MAIN' | 'GALLERY';
    type: MediaType;
    thumbnailUrl: string | null;
    mediumUrl: string | null;
    durationMs: number | null;
    sortOrder: number;
  }>;
  seller: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    contact: {
      zaloProfileId: string;
      phoneNumber: string | null;
    } | null;
  };
  createdAt: string;
  publishedAt: string | null;
};
