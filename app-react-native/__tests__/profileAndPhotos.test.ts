import {
  validatePhone,
  validateRequiredName,
} from '../src/core/validators';
import { normalizeImageContentType } from '../src/data/imageService';

describe('validateRequiredName', () => {
  it('refuse un nom vide ou composé d’espaces', () => {
    expect(validateRequiredName('')).not.toBeNull();
    expect(validateRequiredName('   ')).not.toBeNull();
  });

  it('accepte un nom renseigné', () => {
    expect(validateRequiredName('Ali Ben Salah')).toBeNull();
  });
});

describe('validatePhone', () => {
  it('accepte un téléphone vide (facultatif)', () => {
    expect(validatePhone('')).toBeNull();
    expect(validatePhone('   ')).toBeNull();
  });

  it('accepte les formats tunisiens courants', () => {
    expect(validatePhone('98 123 456')).toBeNull();
    expect(validatePhone('+216 98 123 456')).toBeNull();
    expect(validatePhone('98123456')).toBeNull();
  });

  it('refuse les numéros trop courts, trop longs ou avec des lettres', () => {
    expect(validatePhone('1234567')).not.toBeNull();
    expect(validatePhone('1234567890123456')).not.toBeNull();
    expect(validatePhone('98abc456')).not.toBeNull();
  });
});

describe('normalizeImageContentType', () => {
  it('convertit image/jpg en image/jpeg', () => {
    expect(normalizeImageContentType('image/jpg')).toBe('image/jpeg');
    expect(normalizeImageContentType('IMAGE/JPEG')).toBe('image/jpeg');
  });

  it('conserve les types autorisés', () => {
    expect(normalizeImageContentType('image/png')).toBe('image/png');
    expect(normalizeImageContentType('image/webp')).toBe('image/webp');
  });

  it('conserve un type inconnu pour que la validation l’explique', () => {
    expect(normalizeImageContentType('image/heic')).toBe('image/heic');
  });

  it('déduit le type de l’extension si le type est absent', () => {
    expect(normalizeImageContentType(undefined, 'photo.PNG')).toBe('image/png');
    expect(normalizeImageContentType(null, 'photo.webp')).toBe('image/webp');
  });

  it('utilise JPEG par défaut', () => {
    expect(normalizeImageContentType(undefined)).toBe('image/jpeg');
    expect(normalizeImageContentType('', 'photo')).toBe('image/jpeg');
  });
});
