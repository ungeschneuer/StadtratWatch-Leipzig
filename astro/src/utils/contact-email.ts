import { encodeEmail, spellOutEmail } from '@utils/email-encoding';
import { CONTACT_EMAIL } from '@utils/site-config';

// The address never appears as plain text in the built HTML, so harvesters that scan pages for addresses miss it.
// The browser decodes it; without JavaScript, readers see the spelled-out form.
export const SPELLED_OUT_CONTACT_EMAIL = spellOutEmail(CONTACT_EMAIL);
export const ENCODED_CONTACT_EMAIL = encodeEmail(CONTACT_EMAIL);
