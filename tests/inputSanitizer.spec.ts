import { test, expect } from '@playwright/test';
import { validateIdeaInput } from '@/lib/validation/inputSanitizer';

// We use Playwright's built-in test runner for consistency with the repo.

test.describe('Input Validation & Sanitization', () => {
  test('SQL Injection Prevention', () => {
    const maliciousInputs = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM users--",
    ];

    for (const input of maliciousInputs) {
      const result = validateIdeaInput(input);
      expect(result.sanitized).not.toContain('DROP');
      expect(result.sanitized).not.toContain('UNION');
      expect(result.sanitized).not.toContain('--');
    }
  });

  test('XSS Attack Prevention', () => {
    const xssInputs = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "javascript:alert('XSS')",
      "<iframe src='javascript:alert(1)'></iframe>",
      "<<SCRIPT>alert('XSS');//<</SCRIPT>",
    ];

    for (const input of xssInputs) {
      const result = validateIdeaInput(input);
      expect(result.sanitized).not.toContain('<script');
      expect(result.sanitized).not.toContain('javascript:');
      expect(result.sanitized).not.toContain('onerror=');
      expect(result.isValid).toBe(false);
    }
  });

  test('Maximum Length Enforcement', () => {
    const longInput = 'a'.repeat(10001);
    const result = validateIdeaInput(longInput);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('maximum length');
    expect(result.sanitized.length).toBeLessThanOrEqual(10000);
  });

  test('Minimum Length Enforcement', () => {
    const shortInputs = ['', 'a', 'ab'];
    for (const input of shortInputs) {
      const result = validateIdeaInput(input);
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/minimum length|least/i);
    }
  });

  test('HTML Entity Encoding', () => {
    const input = 'Mobile app <b>for</b> fitness & wellness';
    const result = validateIdeaInput(input);
    expect(result.sanitized).not.toContain('<b>');
    expect(result.sanitized).toContain('&lt;b&gt;');
  });

  test('Unicode and Emoji Handling', () => {
    const input = 'Mobile app 📱 for fitness 💪 $19/month';
    const result = validateIdeaInput(input);
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toContain('Mobile app');
    expect(result.sanitized).toContain('fitness');
  });

  test('Special Character Validation', () => {
    const validInput = "B2B SaaS @ $99/month for SMB's";
    const result = validateIdeaInput(validInput);
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toContain('$99');
  });
});
