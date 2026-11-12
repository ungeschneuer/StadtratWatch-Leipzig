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

export type RegistryPerson = {
  id: string;
  name: string;
  factionId: string;
  partyId: string;
  start: string | null;
  end: string | null;
};
