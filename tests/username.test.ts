import { describe, it, expect } from 'vitest';
import { validateUsername } from '../firebase/auth';

describe('Username Validation Engine', () => {
  it('should accept valid handles', () => {
    expect(validateUsername('PoolPlayer_99').valid).toBe(true);
    expect(validateUsername('AceCue').valid).toBe(true);
    expect(validateUsername('Strike123').valid).toBe(true);
  });

  it('should reject names shorter than 3 characters', () => {
    const res = validateUsername('ab');
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/at least 3 characters/);
  });

  it('should reject names longer than 15 characters', () => {
    const res = validateUsername('ThisUsernameIsWayTooLong123');
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/cannot exceed 15 characters/);
  });

  it('should reject special characters or spaces', () => {
    expect(validateUsername('pool player').valid).toBe(false);
    expect(validateUsername('cue!master').valid).toBe(false);
    expect(validateUsername('pool@arena').valid).toBe(false);
  });

  it('should reject reserved system words', () => {
    expect(validateUsername('admin').valid).toBe(false);
    expect(validateUsername('system').valid).toBe(false);
  });
});
