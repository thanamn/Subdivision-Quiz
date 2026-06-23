import { mediaKindLabel } from "../domain/subdivisionMedia";
import type { SubdivisionMedia } from "../domain/types";

function mediaCreditDetail(media: SubdivisionMedia, label: string) {
  return [
    label,
    "Wikimedia Commons",
    media.credit,
    media.artist,
    media.licenseShortName,
  ]
    .filter(Boolean)
    .join(" · ");
}

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
  const creditDetail = mediaCreditDetail(media, label);

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

export function SubdivisionMediaThumbnail({
  media,
  name,
}: {
  media: SubdivisionMedia | undefined;
  name: string;
}) {
  if (!media) {
    return null;
  }

  const label = mediaKindLabel(media);

  return (
    <span
      className="subdivision-media-thumb"
      title={mediaCreditDetail(media, label)}
    >
      <img
        src={media.imageUrl}
        alt={`${label} for ${name}`}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
