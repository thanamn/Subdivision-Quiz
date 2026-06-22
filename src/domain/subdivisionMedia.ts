import type {
  SubdivisionFeature,
  SubdivisionMedia,
  SubdivisionMediaLookup,
} from "./types";

export function mediaForFeature(
  feature: SubdivisionFeature | undefined,
  lookup: SubdivisionMediaLookup,
): SubdivisionMedia | undefined {
  const qid = feature?.properties.wikidataId;
  return qid ? lookup[qid] : undefined;
}

export function mediaKindLabel(media: SubdivisionMedia) {
  return media.kind === "flag" ? "Flag" : "Emblem";
}
