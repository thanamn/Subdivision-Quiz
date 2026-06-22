const MARK_CHAR = /\p{Mark}/u;
const LETTER_CHAR = /\p{Letter}/u;
const LATIN_CHAR = /\p{Script=Latin}/u;
const LATIN_SPECIAL_FOLDS: Record<string, string> = {
  æ: "ae",
  đ: "d",
  ð: "d",
  ħ: "h",
  ı: "i",
  ł: "l",
  ŋ: "n",
  œ: "oe",
  ø: "o",
  ß: "ss",
  þ: "th",
};
const LATIN_SPECIAL_FOLD_PATTERN = /[æđðħıłŋœøßþ]/gu;

function foldSearchText(value: string) {
  const decomposed = value.normalize("NFKD");
  let folded = "";
  let markBase: "latin" | "other" | null = null;

  for (const char of decomposed) {
    if (MARK_CHAR.test(char)) {
      if (markBase === "other") {
        folded += char;
      }
      continue;
    }

    folded += char;
    markBase = LETTER_CHAR.test(char)
      ? LATIN_CHAR.test(char)
        ? "latin"
        : "other"
      : null;
  }

  return folded.normalize("NFC");
}

export function normalizeGuess(value: string) {
  return foldSearchText(value)
    .toLowerCase()
    .replace(
      LATIN_SPECIAL_FOLD_PATTERN,
      (char) => LATIN_SPECIAL_FOLDS[char] || char,
    )
    .replace(/&/g, " and ")
    .replace(/['\u2019]/g, "")
    .replace(/[^\p{Letter}\p{Number}\p{Mark}]+/gu, " ")
    .trim()
    .normalize("NFC");
}
