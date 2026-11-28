
export type Track = {
  id: string;
  title: string;
  artist: string;
  url: string;
  thumbnail: string | null;
};

export type RepeatMode = "off" | "all" | "one";
