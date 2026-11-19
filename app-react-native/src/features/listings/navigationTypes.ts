import type { NavigatorScreenParams } from '@react-navigation/native';

// Six sections, comme l'application Flutter : Annonces, Carte, Favoris,
// Publier, Messages, Profil.
export type HomeTabParamList = {
  Accueil: undefined;
  Carte: undefined;
  Favoris: undefined;
  Publication: undefined;
  Messages: undefined;
  Profil: undefined;
};

// Le Marketplace est accessible sans compte : les écrans d'authentification
// sont empilés à la demande (comme requireSignIn côté Flutter).
export type AppStackParamList = {
  Tabs: NavigatorScreenParams<HomeTabParamList> | undefined;
  ListingDetail: { listingId: string };
  EditListing: { listingId: string };
  AllListings: undefined;
  Chat: { conversationId: string };
  Notifications: undefined;
  Login: undefined;
  Register: undefined;
  ResetPassword: undefined;
};
