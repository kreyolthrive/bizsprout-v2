// ============================================================================
// CLIENT-SIDE VALIDATION FORM
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

interface ValidationError {
  field: string;
  message: string;
}

interface FormData {
  ideaText: string;
  email: string;
}

export type ValidationFormProps = {
  onValidated?: (result: ValidationPayload) => void;
  navigateOnSuccess?: boolean; // default true
};

type ValidationPayload = {
  id?: string;
  persisted?: boolean;
  scores?: { overall?: number } | undefined;
  business_dna?: { businessModel?: string } | undefined;
  business_model?: { inferred_model?: string } | undefined;
  market_intelligence?: { marketCategory?: string } | undefined;
} & Record<string, unknown>;

type ApiResponse = ValidationPayload & {
  error?: string;
  message?: string;
  errors?: ValidationError[];
  retryAfter?: number | string;
};

export function ValidationForm({ onValidated, navigateOnSuccess = true }: ValidationFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    ideaText: '',
    email: '',
  });

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  const [toasts, setToasts] = useState<Array<{ id: number; kind: 'info' | 'error' | 'success'; text: string }>>([]);
  const toastCounter = React.useRef(0);

  function pushToast(kind: 'info' | 'error' | 'success', text: string, ttlMs = 5000) {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, kind, text }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ttlMs);
  }

  // Countdown + cleanup for rate limiting
  useEffect(() => {
    if (!rateLimited || retryAfter <= 0) return;
    const timer = setInterval(() => {
      setRetryAfter((prev) => {
        if (prev <= 1) {
          setRateLimited(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimited, retryAfter]);

  // Prime CSRF token (GET issues a token cookie and returns token header for clients)
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const resp = await fetch('/api/validate', { method: 'GET' });
        if (!aborted) {
          const token = resp.headers.get('x-csrf-token') || undefined;
          if (token) setCsrfToken(token);
        }
      } catch {}
    })();
    return () => { aborted = true; };
  }, []);

  // Client-side validation (UX enhancement only - not for security)
  const validateClientSide = (): boolean => {
    const newErrors: ValidationError[] = [];

    // Validate idea text
    const ideaText = formData.ideaText.trim();

    if (ideaText.length < 10) {
      newErrors.push({
        field: 'ideaText',
        message: 'Please provide at least 10 characters describing your business idea',
      });
    }

    if (ideaText.length > 10000) {
      newErrors.push({
        field: 'ideaText',
        message: 'Business idea is too long (max 10,000 characters)',
      });
    }

    // Check for suspicious patterns (user-friendly warning)
    if (/<script|javascript:|onerror=/i.test(ideaText)) {
      newErrors.push({
        field: 'ideaText',
        message: 'Please remove any code or scripts from your business description',
      });
    }

    // Validate email if provided
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.push({
          field: 'email',
          message: 'Please enter a valid email address',
        });
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!validateClientSide()) {
      return;
    }

    setIsSubmitting(true);
    setErrors([]);

    try {
      const submitOnce = async () => {
        return await fetch('/api/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
          },
          body: JSON.stringify({ ideaText: formData.ideaText }),
        });
      };

      let response = await submitOnce();
  // Robust parse: prefer JSON, gracefully fall back to text to avoid Runtime SyntaxError
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let result: ApiResponse = {};
  if (contentType.includes('application/json')) {
    try {
      result = await response.json();
    } catch {
      result = { error: 'invalid_json', message: 'Received invalid JSON from server' };
    }
  } else {
    try {
      const text = await response.text();
      result = { error: 'non_json', message: text };
    } catch {
      result = { error: 'non_json', message: '' };
    }
  }

  // If server did not return JSON, surface a friendly error and stop here
  if (!contentType.includes('application/json')) {
    setErrors([
      {
        field: 'general',
        message: 'Unexpected response from validation service. Please try again.',
      },
    ]);
    pushToast('error', 'Unexpected response from validation service. Please try again.');
    return;
  }

      if (!response.ok) {
        // Handle rate limiting (accept our API shape: error or 429)
        if (response.status === 429 || result.error === 'rate_limit_exceeded') {
          setRateLimited(true);
          const retry = Number(result.retryAfter || response.headers.get('Retry-After') || 60);
          setRetryAfter(Number.isFinite(retry) ? retry : 60);
          pushToast('error', `Too many requests. Try again in ${Math.max(1, Math.ceil(Number(retry)))}s.`);
          return;
        }

        // CSRF failure: refresh once and automatically retry
        if (response.status === 403 || result.error === 'csrf_required') {
          try {
            const prime = await fetch('/api/validate', { method: 'GET' });
            const token = prime.headers.get('x-csrf-token') || undefined;
            if (token) setCsrfToken(token);
          } catch {}
          // brief micro-wait to allow state update
          await new Promise((r) => setTimeout(r, 10));
          response = await submitOnce();
          const ct2 = (response.headers.get('content-type') || '').toLowerCase();
          if (ct2.includes('application/json')) {
            try { result = await response.json() as ApiResponse; } catch { result = { error: 'invalid_json' }; }
          }
          if (!response.ok) {
            pushToast('error', 'Validation failed. Please try again.');
            return;
          }
        }

        // Handle validation errors
        if (Array.isArray(result.errors)) {
          setErrors(result.errors);
          return;
        }

        // Generic error
        setErrors([
          {
            field: 'general',
            message: (typeof result?.message === 'string' && result.message.trim())
              ? result.message
              : 'An error occurred. Please try again.',
          },
        ]);
        pushToast('error', 'Validation failed. Please try again.');
        return;
      }

      // Success: Save to sessionStorage for the results page
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('validationResult', JSON.stringify(result));
        }
      } catch {}

      // Inline mode: provide raw result to parent and skip navigation
      if (onValidated && navigateOnSuccess === false) {
        try { onValidated((result as ValidationPayload) || {}); } catch {}
        return;
      }

      // Prefer server-side storage id and navigate to /results/:id
      // Show a loading state during navigation
      try {
  const payload: ValidationPayload = (result as ValidationPayload) || {};
        const id: string | undefined = typeof payload.id === 'string' ? payload.id : undefined;
        const persisted: boolean = Boolean(payload.persisted);
        if (id && persisted) {
          setIsNavigating(true);
          await router.push(`/results/${encodeURIComponent(id)}`);
        } else {
          // Fallback: use minimal URL params if no id returned
          const overall = (payload?.scores?.overall != null) ? String(payload.scores?.overall) : '';
          const businessModel = (payload?.business_dna?.businessModel
            || payload?.business_model?.inferred_model
            || payload?.market_intelligence?.marketCategory
            || 'General');
          const params = new URLSearchParams();
          if (overall) params.set('score', overall);
          if (businessModel) params.set('businessModel', String(businessModel));
          setIsNavigating(true);
          await router.push(`/results?${params.toString()}`);
        }
      } catch {
        // As a last resort, go to generic results page
        setIsNavigating(true);
        await router.push('/results');
      }
      } catch (error) {
      console.error('Submission error:', error);
      setErrors([
        {
          field: 'general',
          message: 'Network error. Please check your connection and try again.',
        },
      ]);
        pushToast('error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldError = (field: string): string | undefined => {
    return errors.find(e => e.field === field)?.message;
  };

  const generalError = errors.find(e => e.field === 'general');

  const busy = isSubmitting || isNavigating;
  const formA11y: Record<string, string> = busy ? { 'aria-busy': 'true' } : {};

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6" {...formA11y}>
      {/* Toasts */}
      <div className="fixed top-3 right-3 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-md shadow text-white ${
              t.kind === 'success' ? 'bg-emerald-600' : t.kind === 'info' ? 'bg-blue-600' : 'bg-red-600'
            }`}
            role="status"
            aria-live="polite"
          >
            {t.text}
          </div>
        ))}
      </div>
      <h2 className="text-2xl font-bold mb-6">Get Free Validation</h2>

  {/* General Error Message */}
      {generalError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <p className="text-red-800">{generalError.message}</p>
        </div>
      )}

  {/* Rate Limit Warning */}
      {rateLimited && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg" role="alert">
          <p className="text-yellow-800 font-medium">Rate Limit Exceeded</p>
          <p className="text-yellow-700 text-sm mt-1">
            Please wait {retryAfter} seconds before submitting again.
          </p>
        </div>
      )}

      {/* Live region for status updates (polite) */}
      <p className="sr-only" role="status" aria-live="polite">
        {isSubmitting ? 'Validating your idea…' : isNavigating ? 'Opening results…' : ''}
      </p>

      {/* Business Idea Input + Inline Submit */}
      {(() => {
        const ideaInvalid = Boolean(getFieldError('ideaText'));
        const ideaA11y: Record<string, string> = ideaInvalid
          ? { 'aria-invalid': 'true', 'aria-describedby': 'ideaText-error' }
          : {};
        const disabled = isSubmitting || isNavigating || rateLimited;
        const tooShort = formData.ideaText.trim().length < 10;
        return (
          <div className="mb-6">
            <label htmlFor="ideaText" className="block text-sm font-medium text-gray-700 mb-2">
              Describe Your Business Idea
            </label>
            <div className="flex flex-col gap-4">
              <textarea
                id="ideaText"
                value={formData.ideaText}
                onChange={(e) => setFormData({ ...formData, ideaText: e.target.value })}
                {...ideaA11y}
                className="validation-input"
                placeholder="Describe your business idea in detail (who it's for, the problem, what you offer, how it works) — example: A platform connecting local artisans making eco-friendly leather bags with boutique retailers through curated drops."
                maxLength={10000}
                rows={6}
                disabled={disabled}
              />
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="submit"
                  disabled={disabled || tooShort}
                  className={`validate-button ${disabled || tooShort ? 'disabled opacity-60 cursor-not-allowed' : ''}`}
                  data-testid="validate-submit"
                  aria-label="Validate my idea"
                >
                  {isSubmitting
                    ? 'Validating...'
                    : isNavigating
                      ? 'Opening results...'
                      : rateLimited
                        ? `Wait ${retryAfter}s`
                        : 'Validate My Idea'}
                </button>
                <div className="text-xs text-gray-500 flex-1 leading-snug">
                  {tooShort ? 'Add a little more detail for better signal (min 10 chars).' : 'We analyze traction signals, model viability & risks instantly.'}
                </div>
              </div>
            </div>
            <div className="mt-1">
              {getFieldError('ideaText') && (
                <p id="ideaText-error" className="text-sm text-red-600" role="alert">{getFieldError('ideaText')}</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Email field removed per request */}

      <p className="text-xs text-gray-500 mt-4 text-center">
        Your idea is analyzed instantly. No credit card required.
      </p>
      </form>
  );
}
