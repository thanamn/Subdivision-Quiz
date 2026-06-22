import { localNameText, nativeNameText } from "../domain/featureNames";
import type { SubdivisionFeature } from "../domain/types";

export function NativeNameLine({ feature }: { feature: SubdivisionFeature }) {
  const text = nativeNameText(feature);
  return text ? <span className="native-name">{text}</span> : null;
}

export function LocalNameLine({ feature }: { feature: SubdivisionFeature }) {
  const text = localNameText(feature);
  return text ? <span className="local-name">{text}</span> : null;
}
