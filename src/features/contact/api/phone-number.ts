import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/hooks/use-session';
import type { ZaloPhoneShare } from '@/features/contact/services/zalo-phone';
import { http } from '@/lib/http';

/** The number buyers call, verified by Zalo; null until the seller shares it. */
type PhoneNumber = string | null;

export const phoneNumberKey = (userId: string | null) => ['phone-number', userId] as const;

/** The signed-in seller's shared phone number (`GET /me`); idle until the session exists. */
export function useMyPhoneNumber() {
  const userId = useSession().session?.user.id ?? null;

  return useQuery({
    queryKey: phoneNumberKey(userId),
    enabled: userId !== null,
    queryFn: async () => {
      const response = await http.get<{ data: { phoneNumber: PhoneNumber } }>('/me');
      return response.data.data.phoneNumber;
    },
  });
}

/** `POST /me/phone-number`, then every screen shows the number the server stored. */
export function useSharePhoneNumber() {
  const queryClient = useQueryClient();
  const userId = useSession().session?.user.id ?? null;

  return useMutation({
    mutationFn: async (share: ZaloPhoneShare) => {
      const response = await http.post<{ data: { phoneNumber: PhoneNumber } }>(
        '/me/phone-number',
        share,
      );
      return response.data.data.phoneNumber;
    },
    onSuccess: (phoneNumber) => queryClient.setQueryData(phoneNumberKey(userId), phoneNumber),
  });
}
