import {
  CONTACT_EMAIL,
  OPERATOR_NAME,
  SITE_NAME,
  UPSTREAM_PROJECT,
} from '@utils/site-config';

export function generateMeta() {
  return {
    stadtratwatch_api: {
      version: '1.0',
      license: 'CC0 1.0',
      license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      publisher: {
        name: OPERATOR_NAME,
        email: CONTACT_EMAIL,
        project: SITE_NAME,
      },
      based_on: {
        name: UPSTREAM_PROJECT.name,
        url: UPSTREAM_PROJECT.sourceRepositoryUrl,
      },
    },
  };
}
