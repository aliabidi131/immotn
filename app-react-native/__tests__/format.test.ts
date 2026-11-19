import {
  formatDate,
  formatHourOrDate,
  formatPrice,
  formatQuantity,
  toDate,
  transactionLabel,
  typeBienLabel,
} from '../src/core/format';

describe('formatPrice', () => {
  test('regroupe les milliers avec des espaces', () => {
    expect(formatPrice(125000)).toBe('125 000 TND');
    expect(formatPrice(1200000)).toBe('1 200 000 TND');
    expect(formatPrice(650)).toBe('650 TND');
    expect(formatPrice(0)).toBe('0 TND');
  });

  test('arrondit les décimales comme Flutter', () => {
    expect(formatPrice(999.6)).toBe('1 000 TND');
  });
});

describe('formatQuantity', () => {
  test('affiche 120 et non 120.0', () => {
    expect(formatQuantity(120)).toBe('120');
    expect(formatQuantity(12.5)).toBe('12.5');
  });
});

describe('libellés', () => {
  test('transactionLabel et typeBienLabel', () => {
    expect(transactionLabel('vente')).toBe('Vente');
    expect(transactionLabel('location')).toBe('Location');
    expect(typeBienLabel('local')).toBe('Local commercial');
    expect(typeBienLabel('villa')).toBe('Villa');
  });

  test('une valeur inconnue est renvoyée telle quelle', () => {
    expect(typeBienLabel('chalet')).toBe('chalet');
    expect(transactionLabel('troc')).toBe('troc');
  });
});

describe('dates', () => {
  test('formatDate -> jj/mm/aaaa', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('05/01/2026');
  });

  test("formatHourOrDate : l'heure le jour même, sinon jj/mm", () => {
    const now = new Date(2026, 10, 19, 15, 0);
    expect(formatHourOrDate(new Date(2026, 10, 19, 9, 5), now)).toBe('09:05');
    expect(formatHourOrDate(new Date(2026, 10, 18, 9, 5), now)).toBe('18/11');
  });

  test('toDate lit un Timestamp Firestore ou renvoie null', () => {
    const date = new Date(2026, 1, 3);
    expect(toDate({ toDate: () => date })).toBe(date);
    expect(toDate(null)).toBeNull();
    expect(toDate('2026-02-03')).toBeNull();
    expect(toDate({})).toBeNull();
  });
});
