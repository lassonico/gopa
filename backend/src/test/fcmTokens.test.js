import { describe, it, expect } from 'vitest';
import util from '../utils/fcmTokens.js';

const { parseTokens, serializeTokens, addToken, removeToken } = util;

describe('fcmTokens - multi-dispositivo', () => {
  it('parseTokens lee la lista fcmTokens y el fcmToken legacy sin duplicar', () => {
    const user = { fcmTokens: JSON.stringify(['a', 'b']), fcmToken: 'b' };
    expect(parseTokens(user).sort()).toEqual(['a', 'b']);
  });

  it('parseTokens soporta usuario solo-legacy (sin fcmTokens)', () => {
    expect(parseTokens({ fcmToken: 'solo' })).toEqual(['solo']);
  });

  it('parseTokens tolera valores vacíos o corruptos', () => {
    expect(parseTokens(null)).toEqual([]);
    expect(parseTokens({ fcmTokens: 'no-json', fcmToken: '' })).toEqual(['no-json']);
    expect(parseTokens({ fcmTokens: '' })).toEqual([]);
  });

  it('addToken agrega sin pisar los demás dispositivos', () => {
    const user = { fcmTokens: JSON.stringify(['web']), fcmToken: 'web' };
    const tokens = addToken(user, 'celular');
    expect(tokens).toEqual(['web', 'celular']);
    expect(JSON.parse(serializeTokens(tokens))).toEqual(['web', 'celular']);
  });

  it('removeToken quita solo el token indicado', () => {
    const user = { fcmTokens: JSON.stringify(['a', 'b', 'c']), fcmToken: 'c' };
    expect(removeToken(user, 'b')).toEqual(['a', 'c']);
  });
});
