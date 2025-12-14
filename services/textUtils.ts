const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F-\u009F]/g;
const WHITESPACE_REGEX = /\s+/g;

export const sanitizeText = (value?: string | number | null): string => {
  if (value === undefined || value === null) {
    return '';
  }
  const stringValue = String(value);
  const normalized = stringValue.normalize('NFKC');
  const withoutControlChars = normalized.replace(CONTROL_CHARS_REGEX, '');
  return withoutControlChars.replace(WHITESPACE_REGEX, ' ').trim();
};

export const normalizeForMatch = (value?: string | number | null): string => {
  return sanitizeText(value).toLowerCase();
};
