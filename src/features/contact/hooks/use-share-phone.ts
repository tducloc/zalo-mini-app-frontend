import { useState } from 'react';

import { useSharePhoneNumber } from '@/features/contact/api/phone-number';
import { requestPhoneShare } from '@/features/contact/services/zalo-phone';
import { phoneShareFailure, phoneShareSuccess } from '@/features/contact/utils/phone';
import { useToast } from '@/hooks/use-toast';
import { warnInDev } from '@/utils/dev-log';

/** Zalo's permission prompt, then `POST /me/phone-number`, saying how it went. */
export function useSharePhone() {
  const mutation = useSharePhoneNumber();
  const { showError, showInfo, showSuccess } = useToast();
  // Also while Zalo's prompt is open, before the request starts.
  const [isSharing, setSharing] = useState(false);

  const share = async () => {
    setSharing(true);
    try {
      await mutation.mutateAsync(await requestPhoneShare());
      showSuccess(phoneShareSuccess);
    } catch (error) {
      warnInDev('contact', 'sharing the phone number failed', error);
      const failure = phoneShareFailure(error);
      (failure.isRefusal ? showInfo : showError)(failure.message);
    } finally {
      setSharing(false);
    }
  };

  return { share, isSharing };
}
