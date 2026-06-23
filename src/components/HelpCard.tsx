import { Info, X } from "lucide-react";

export function HelpCard({ dismissHelpCard }: { dismissHelpCard: () => void }) {
  return (
    <aside className="help-card" aria-label="How to play">
      <Info size={18} aria-hidden="true" />
      <div>
        <strong>How to play</strong>
        <p>
          Pick a country, region, or the whole world, then choose how you want
          to play.
        </p>
        <ul>
          <li>Type mode accepts English, local, romanized, or native-script names.</li>
          <li>
            Click mode gives you a name, plus a flag or emblem when available.
          </li>
          <li>Small subdivisions may appear as clickable dots when they are hard to select at the current zoom.</li>
          <li>Wrong clicks reveal what you clicked and count against accuracy.</li>
          <li>Hints draw a shrinking search area without centering the answer.</li>
          <li>Shortcuts in Click mode: H for hint, S to skip, A to show the answer.</li>
          <li>Your progress saves automatically; Reset starts this quiz over.</li>
        </ul>
      </div>
      <button
        type="button"
        className="help-dismiss"
        title="Dismiss"
        onClick={dismissHelpCard}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </aside>
  );
}
