/** Простой regex для обнаружения URL в тексте */
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/;

export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}
