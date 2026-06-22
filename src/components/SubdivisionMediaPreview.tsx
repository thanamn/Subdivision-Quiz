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
  const creditText = media.licenseShortName
    ? `Wikimedia Commons (${media.licenseShortName})`
    : "Wikimedia Commons";

  return (
    <figure className={`subdivision-media is-${size}`}>
      <img
        src={media.imageUrl}
        alt={`${label} for the current subdivision`}
        loading="lazy"
        decoding="async"
      />
      {size === "large" ? (
        <figcaption>
          <a href={media.commonsUrl} target="_blank" rel="noreferrer">
            {creditText}
          </a>
        </figcaption>
      ) : null}
    </figure>
  );
}
