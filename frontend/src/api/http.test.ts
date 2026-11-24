import { describe, expect, it } from 'vitest';
import { errorMessage } from './http';

function fail(status: number, data: unknown) {
  return { response: { status, data } };
}

describe('errorMessage', () => {
  it('uses the detail message from the API', () => {
    expect(errorMessage(fail(401, { detail: 'No active account found' }))).toBe('No active account found');
  });

  it('joins field errors into one readable sentence', () => {
    const message = errorMessage(fail(400, { contact_phone: ['Enter a valid Tanzanian mobile number.'], year: ['Too old.'] }));
    expect(message).toBe('Contact phone: Enter a valid Tanzanian mobile number. · Year: Too old.');
  });

  it('explains rate limiting and server errors plainly', () => {
    expect(errorMessage(fail(429, {}))).toMatch(/Too many attempts/);
    expect(errorMessage(fail(500, {}))).toMatch(/ran into a problem/);
  });

  it('reports network failures', () => {
    expect(errorMessage({ code: 'ERR_NETWORK' })).toMatch(/Cannot reach the server/);
  });
});
