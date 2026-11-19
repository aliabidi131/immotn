import {
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '../src/core/validators';
import { validateListingDraft } from '../src/features/listings/listingModel';

describe('validateEmail', () => {
  test('refuse un email vide', () => {
    expect(validateEmail('')).not.toBeNull();
    expect(validateEmail('   ')).not.toBeNull();
  });

  test('refuse un email mal formé', () => {
    expect(validateEmail('abc')).not.toBeNull();
    expect(validateEmail('abc@')).not.toBeNull();
    expect(validateEmail('abc@domaine')).not.toBeNull();
  });

  test('accepte un email valide', () => {
    expect(validateEmail('nom@exemple.tn')).toBeNull();
    expect(validateEmail('  nom@exemple.tn  ')).toBeNull();
  });
});

describe('validatePassword', () => {
  test('refuse un mot de passe vide', () => {
    expect(validatePassword('')).not.toBeNull();
  });

  test('refuse un mot de passe trop court', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).not.toBeNull();
  });

  test('accepte un mot de passe de la longueur minimale', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });
});

describe('validatePasswordConfirmation', () => {
  test('refuse deux mots de passe différents', () => {
    expect(validatePasswordConfirmation('secret1', 'secret2')).not.toBeNull();
  });

  describe('validateListingDraft', () => {
    const validDraft = {
      titre: 'Appartement lumineux',
      description: 'Près du centre-ville.',
      typeTransaction: 'vente' as const,
      typeBien: 'appartement',
      prix: '180000',
      surface: '95',
      nombrePieces: '3',
      ville: 'Tunis',
    };

    test('accepte une annonce correctement renseignée', () => {
      expect(validateListingDraft(validDraft)).toBeNull();
    });

    test('refuse un prix ou une surface non positifs', () => {
      expect(validateListingDraft({ ...validDraft, prix: '0' })).toContain('prix');
      expect(validateListingDraft({ ...validDraft, surface: '-1' })).toContain(
        'surface',
      );
    });

    test('refuse un nombre de pièces fractionnaire', () => {
      expect(
        validateListingDraft({ ...validDraft, nombrePieces: '2.5' }),
      ).toContain('pièces');
    });
  });

  test('accepte deux mots de passe identiques', () => {
    expect(validatePasswordConfirmation('secret1', 'secret1')).toBeNull();
  });
});
