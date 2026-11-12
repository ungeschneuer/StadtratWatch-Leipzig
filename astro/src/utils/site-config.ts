import {
  DATA_PULL_REQUEST_URL as DEPLOYED_DATA_PULL_REQUEST_URL,
  DATA_REPOSITORY,
} from 'astro:env/server';

export const SITE_NAME = 'StadtratWatch Leipzig';
export const COUNCIL_NAME = 'Leipziger Stadtrat';
export const CONTACT_EMAIL = 'hallo@schneuer.online';
export const SOURCE_REPOSITORY_URL = `https://github.com/${DATA_REPOSITORY}`;

// StadtratWatch Leipzig is a fork of StadtratWatch Magdeburg; its MIT license requires keeping the credit.
export const UPSTREAM_PROJECT = {
  name: 'StadtratWatch Magdeburg',
  siteUrl: 'https://www.stadtratwatch.de',
  sourceRepositoryUrl: 'https://github.com/JensWinter/StadtratWatch-web',
  maintainers: 'Code for Magdeburg',
  maintainersUrl: 'https://codefor.de/magdeburg',
};

// Reviewers decide open votes on the data branch, and its single open pull request carries every correction until it
// is merged. A search for the branch finds that pull request whatever its number.
export const LEIPZIG_DATA_BRANCH = 'data/leipzig-votings';
export const DATA_PULL_REQUEST_URL =
  DEPLOYED_DATA_PULL_REQUEST_URL ||
  `${SOURCE_REPOSITORY_URL}/pulls?q=${encodeURIComponent(`is:pr is:open head:${LEIPZIG_DATA_BRANCH}`)}`;
