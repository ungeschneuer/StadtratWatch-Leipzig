import { DATA_DISCLAIMER } from '@models/data-disclaimer';
import {
  OPERATOR_NAME,
  OPERATOR_WEBSITE,
  SITE_NAME,
  UPSTREAM_PROJECT,
} from '@utils/site-config';

export function generateMeta() {
  return {
    stadtratwatch_api: {
      version: '1.0',
      license: 'CC0 1.0',
      license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      // CC0 covers what StadtratWatch adds: the votes read from the recordings and the results. Names, memberships,
      // agenda items and titles come from the city under licences that require naming it.
      license_note:
        'CC0 gilt für Stimmen, Ergebnisse und Zuordnungen von StadtratWatch Leipzig. Angaben aus OParl (Personen, Mitgliedschaften, Tagesordnung, Drucksachen) stehen unter CC BY 4.0, die Wahlliste 2024 unter dl-de/by-2-0; Quelle jeweils Stadt Leipzig.',
      disclaimer: DATA_DISCLAIMER,
      attribution: [
        {
          source:
            'Stadt Leipzig, OParl-Schnittstelle des Ratsinformationssystems',
          url: 'https://www.leipzig.sitzung-online.de/oparl/system',
          license: 'CC BY 4.0',
          license_url: 'https://creativecommons.org/licenses/by/4.0/',
        },
        {
          source:
            'Stadt Leipzig, Stadtratswahl 2024: Bewerberinnen und Bewerber',
          url: 'https://opendata.leipzig.de/dataset/stadtratswahl-2024-bewerberinnen-und-bewerber',
          license: 'Datenlizenz Deutschland – Namensnennung – Version 2.0',
          license_url: 'https://www.govdata.de/dl-de/by-2-0',
        },
      ],
      publisher: {
        name: OPERATOR_NAME,
        url: OPERATOR_WEBSITE,
        project: SITE_NAME,
      },
      based_on: {
        name: UPSTREAM_PROJECT.name,
        url: UPSTREAM_PROJECT.sourceRepositoryUrl,
      },
    },
  };
}
