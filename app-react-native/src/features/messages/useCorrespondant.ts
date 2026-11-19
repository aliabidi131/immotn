import { useEffect, useState } from 'react';
import { displayNameOf } from '../../data/messagingModel';
import { watchUserProfile } from '../../data/userService';

// Nom et photo publics d'un utilisateur, lus depuis users/{uid}
// (_Correspondant côté Flutter).
export function useCorrespondant(uid: string): { name: string; photoUrl: string } {
  const [state, setState] = useState({
    name: displayNameOf(''),
    photoUrl: '',
  });

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    return watchUserProfile(uid, profile => {
      setState({
        name: displayNameOf(profile?.nom),
        photoUrl:
          typeof profile?.photoUrl === 'string' ? profile.photoUrl.trim() : '',
      });
    });
  }, [uid]);

  return state;
}
