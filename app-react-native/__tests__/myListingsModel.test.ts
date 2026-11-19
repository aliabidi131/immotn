import {
  ACTION_LABELS,
  availableActions,
} from '../src/features/profile/myListingsModel';

describe('availableActions', () => {
  it('annonce active : modifier, vendue, masquer, supprimer', () => {
    expect(availableActions('active')).toEqual([
      'edit',
      'vendue',
      'masquee',
      'delete',
    ]);
  });

  it('annonce masquée : modifier, vendue, remettre en ligne, supprimer', () => {
    expect(availableActions('masquee')).toEqual([
      'edit',
      'vendue',
      'active',
      'delete',
    ]);
  });

  it('annonce vendue : pas de « vendue », remise en ligne possible', () => {
    expect(availableActions('vendue')).toEqual(['edit', 'active', 'delete']);
  });

  it('propose toujours modifier et supprimer', () => {
    for (const statut of ['active', 'vendue', 'masquee', 'inconnu']) {
      const actions = availableActions(statut);
      expect(actions[0]).toBe('edit');
      expect(actions[actions.length - 1]).toBe('delete');
    }
  });

  it('chaque action a un libellé', () => {
    for (const action of availableActions('masquee')) {
      expect(ACTION_LABELS[action].length).toBeGreaterThan(0);
    }
  });
});
