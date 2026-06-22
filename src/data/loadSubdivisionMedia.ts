import type {
  SubdivisionMediaData,
  SubdivisionMediaLookup,
} from "../domain/types";

export async function loadSubdivisionMedia(url: string): Promise<SubdivisionMediaLookup> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {};
    }

    const data = (await response.json()) as SubdivisionMediaData;
    return data.media || {};
  } catch {
    return {};
  }
}
