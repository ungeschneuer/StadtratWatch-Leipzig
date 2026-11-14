export type Registry = {
  id: string;
  name: string;
  lastUpdate: string;
  sessions: RegistrySession[];
  factions: RegistryFaction[];
  parties: RegistryParty[];
  persons: RegistryPerson[];
};

export type RegistrySession = {
  id: string;
  date: string;
  title: string;
  // Empty when the recording is not on YouTube; `video` then names where it is.
  youtubeUrl: string;
  video?: RegistrySessionVideo;
  meetingMinutesUrl: string | null;
  approved: boolean;
  oparlMeetingId?: string;
  // Set when the texts of the speeches are taken from an official record (Leipzig's Verlaufsprotokoll) rather than
  // transcribed. The site then names the record and shows the full texts only on the session page: a collection of the
  // speeches of one person is not covered by § 48 UrhG.
  speechesSource?: RegistrySpeechesSource;
};

export type RegistrySpeechesSource = {
  label: string;
  url: string;
};

// A recording outside YouTube, such as a city's own media library. Links to it cannot jump to a time.
export type RegistrySessionVideo = {
  url: string;
  label: string;
  // A player page that starts at a given second when `startsekunde` is added (Leipzig's video hoster).
  playerUrl?: string;
};

// id is the readable key the site's addresses use; oparlId is the stable key of the council's OParl, where it has one
// (not for the pseudo-factions of members without faction and of the mayor).
export type RegistryFaction = {
  id: string;
  name: string;
  seats: number;
  oparlId?: string | null;
};

export type RegistryParty = {
  id: string;
  name: string;
  seats: number;
  additionalInformation?: { key: string; value: string }[];
};

// factionId and partyId are the latest. Where they changed during the period, factionMemberships and partyMemberships
// say which held on which day; without them factionId and partyId hold for the whole membership.
export type RegistryPerson = {
  id: string;
  name: string;
  oparlId?: string;
  factionId: string;
  partyId: string;
  start: string | null;
  end: string | null;
  factionMemberships?: RegistryFactionMembership[];
  partyMemberships?: RegistryPartyMembership[];
  // Committees, supervisory boards and other bodies the member sat in during the period, as OParl lists them.
  bodies?: RegistryBodyMembership[];
};

export type RegistryBodyMembership = {
  name: string;
  // OParl classification: Ausschuss, Aufsichtsrat, Zweckverband, Beirat …
  kind: string;
  role: string | null;
  start: string;
  end: string | null;
};

export type RegistryFactionMembership = {
  factionId: string;
  start: string;
  end: string | null;
};

export type RegistryPartyMembership = {
  partyId: string;
  start: string;
  end: string | null;
};
