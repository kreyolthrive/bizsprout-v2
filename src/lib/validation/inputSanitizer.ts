export interface ValidationResult {
  isValid: boolean;
  sanitized: string;
  error?: string;
}

// Core validation and sanitization for idea input
export function validateIdeaInput(input: string): ValidationResult {
  // Guard only for null/undefined/non-string
  if (input == null || typeof input !== 'string') {
    return { isValid: false, sanitized: '', error: 'Input is required' };
  }

  // Normalize whitespace
  let sanitized = input.trim();

  // XSS prevention: strip known-dangerous constructs
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onerror=, onclick=, etc.
    /<embed\b/gi,
    /<object\b/gi,
  ];
  let hasXSS = false;
  for (const re of xssPatterns) {
    if (re.test(sanitized)) hasXSS = true;
    sanitized = sanitized.replace(re, '');
  }
  if (hasXSS) {
    return { isValid: false, sanitized: '', error: 'Input contains potentially malicious content' };
  }

  // SQLi mitigation: remove obvious injection tokens/keywords
  const sqlPatterns = [
    /(\b(DROP|DELETE|INSERT|UPDATE|UNION|SELECT)\b.*\b(TABLE|FROM|WHERE)\b)/gi,
    /('|"|;|--|\*|\/\*|\*\/)/g,
  ];
  for (const re of sqlPatterns) sanitized = sanitized.replace(re, '');
  // Extra hardening: strip any remaining SQL single-line comment markers
  sanitized = sanitized.replace(/--+/g, '');

  // Length limits AFTER cleaning
  const MIN_LENGTH = 10;
  const MAX_LENGTH = 10_000;
  if (sanitized.length < MIN_LENGTH) {
    return { isValid: false, sanitized, error: `Input does not meet minimum length of ${MIN_LENGTH} characters` };
  }
  if (sanitized.length > MAX_LENGTH) {
    return { isValid: false, sanitized: sanitized.substring(0, MAX_LENGTH), error: `Input exceeds maximum length of ${MAX_LENGTH} characters` };
  }

  // HTML-escape for safe display
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return { isValid: true, sanitized };
}
