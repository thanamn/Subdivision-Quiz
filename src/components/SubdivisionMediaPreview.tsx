import { mediaKindLabel } from "../domain/subdivisionMedia";
import type { SubdivisionMedia } from "../domain/types";

export function SubdivisionMediaPreview({
  media,
  size = "small",
}: {
  media: SubdivisionMedia | undefined;
  size?: "small" | "large";
}) {
  if (!media) {
    return null;
  }

  const label = mediaKindLabel(media);
  const compactCredit = media.attributionRequired
    ? [label, media.credit || media.artist || media.licenseShortName || "Wikimedia Commons"]
        .filter(Boolean)
        .join(" · ")
    : `${label} · Wikimedia Commons`;
  const creditDetail = [
    label,
    "Wikimedia Commons",
    media.credit,
    media.artist,
    media.licenseShortName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <figure className={`subdivision-media is-${size}`}>
      <img
        src={media.imageUrl}
        alt={`${label} for current subdivision`}
        loading="lazy"
        decoding="async"
      />
      <figcaption title={creditDetail}>
        <a href={media.commonsUrl} target="_blank" rel="noreferrer">
          {compactCredit}
        </a>
      </figcaption>
    </figure>
  );
}
