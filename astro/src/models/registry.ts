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
};

// A recording outside YouTube, such as a city's own media library. Links to it cannot jump to a time.
export type RegistrySessionVideo = {
  url: string;
  label: string;
};

export type RegistryFaction = {
  id: string;
  name: string;
  seats: number;
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
  factionId: string;
  partyId: string;
  start: string | null;
  end: string | null;
  factionMemberships?: RegistryFactionMembership[];
  partyMemberships?: RegistryPartyMembership[];
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
