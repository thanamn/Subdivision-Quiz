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
      <a
        className="subdivision-media-link"
        href={media.commonsUrl}
        target="_blank"
        rel="noreferrer"
        title={creditDetail}
        aria-label={`${creditDetail}. Opens Wikimedia Commons.`}
      >
        <img
          src={media.imageUrl}
          alt={`${label} for current subdivision`}
          loading="lazy"
          decoding="async"
        />
      </a>
    </figure>
  );
}
