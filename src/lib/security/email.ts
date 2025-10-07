// Constant-time-ish email validation to mitigate timing attacks on early-return branches.
// This does not guarantee full RFC compliance, but aims for stable execution time across inputs.

// Cheap, fixed-length mask to normalize work even for short strings.
const PAD = '________________________'; // 24 chars

// Precompiled ASCII map and simple classification to avoid branching per char.
const ALLOWED_LOCAL = new Set<string>('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._%+-'.split(''));
const ALLOWED_DOMAIN = new Set<string>('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-'.split(''));

function constantTimeCompare(a: string, b: string): boolean {
  // Compare same lengths; consume all chars regardless of matches
  const len = Math.max(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < len; i++) {
    const ca = a.charCodeAt(i) | 0;
    const cb = b.charCodeAt(i) | 0;
    diff |= (ca ^ cb);
  }
  return diff === 0;
}

export async function validateEmail(input: string): Promise<boolean> {
  // Normalize and pad to reduce length-based timing skew
  const s = String(input || '').trim();
  const work = (s + PAD).slice(0, Math.max(24, s.length));

  // 1) Find split at '@' without early-exit
  let atIndex = -1;
  for (let i = 0; i < work.length; i++) {
    // Record first '@' position but continue loop regardless
    if (work[i] === '@' && atIndex === -1) atIndex = i;
  }
  // Make local/domain slices with fixed operations
  const local = atIndex > -1 ? work.slice(0, atIndex) : work.slice(0, Math.min(10, work.length));
  const domain = atIndex > -1 ? work.slice(atIndex + 1) : work.slice(Math.min(10, work.length));

  // 2) Validate characters for both parts without early returns
  let localOk = 1;
  let domainOk = 1;
  for (let i = 0; i < local.length; i++) {
    if (!ALLOWED_LOCAL.has(local[i])) localOk = 0;
  }
  for (let i = 0; i < domain.length; i++) {
    if (!ALLOWED_DOMAIN.has(domain[i])) domainOk = 0;
  }

  // 3) Basic structure checks performed in a balanced way
  const hasAt = atIndex > 0 && atIndex < work.length - 1 ? 1 : 0;
  // Domain must have one dot; check presence but avoid early-return
  let dotCount = 0;
  for (let i = 0; i < domain.length; i++) if (domain[i] === '.') dotCount++;
  const hasDot = dotCount >= 1 ? 1 : 0;

  // 4) TLD min length check (2+) in constant-ish time
  let tldLen = 0;
  for (let i = domain.length - 1; i >= 0; i--) {
    if (domain[i] === '.') break;
    tldLen++;
  }
  const tldOk = tldLen >= 2 ? 1 : 0;

  // Combine all flags; delay the boolean conversion until the end
  const ok = (localOk & domainOk & hasAt & hasDot & tldOk) === 1;

  // Small async boundary to even out microtask scheduling and avoid tight sync return timing differences
  await Promise.resolve();

  return ok;
}

export default validateEmail;
