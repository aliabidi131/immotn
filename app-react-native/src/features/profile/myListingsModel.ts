import {
  STATUT_ACTIVE,
  STATUT_MASQUEE,
  STATUT_VENDUE,
} from '../../core/format';

// Actions possibles sur « Mes annonces » (_MyListingTile de profile_screen.dart).

export type ListingAction =
  | 'edit'
  | typeof STATUT_VENDUE
  | typeof STATUT_MASQUEE
  | typeof STATUT_ACTIVE
  | 'delete';

export const ACTION_LABELS: Record<ListingAction, string> = {
  edit: 'Modifier l’annonce',
  [STATUT_VENDUE]: 'Marquer comme vendue',
  [STATUT_MASQUEE]: 'Masquer',
  [STATUT_ACTIVE]: 'Remettre en ligne',
  delete: 'Supprimer',
};

// Actions proposées selon le statut courant de l'annonce.
export function availableActions(statut: string): ListingAction[] {
  const actions: ListingAction[] = ['edit'];
  if (statut !== STATUT_VENDUE) {
    actions.push(STATUT_VENDUE);
  }
  if (statut === STATUT_ACTIVE) {
    actions.push(STATUT_MASQUEE);
  }
  if (statut !== STATUT_ACTIVE) {
    actions.push(STATUT_ACTIVE);
  }
  actions.push('delete');
  return actions;
}
