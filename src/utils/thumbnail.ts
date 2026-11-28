
export function getYouTubeThumbnail(url: string): string | null {
  try {
    const parsed = new URL(url);
    let videoId: string | null = null;

    if (parsed.hostname === "youtu.be") {
      videoId = parsed.pathname.slice(1);
    } else if (
      parsed.hostname === "youtube.com" ||
      parsed.hostname.endsWith(".youtube.com")
    ) {
      videoId =
        parsed.searchParams.get("v") ??
        parsed.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] ??
        null;
    }

    if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
      return null;
    }

    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  } catch {
    return null;
  }
}
