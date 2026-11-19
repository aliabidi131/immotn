import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { GuestGate, useAppNavigation } from '../../core/components';
import { formatDate, toDate } from '../../core/format';
import { colors, spacing } from '../../core/theme';
import {
  ErrorText,
  FormInput,
  LinkButton,
  PrimaryButton,
} from '../../core/ui';
import { validatePhone, validateRequiredName } from '../../core/validators';
import { getCurrentAuthInfo } from '../../data/authService';
import { watchUserProfile } from '../../data/userService';
import type { UserProfile } from '../../data/userModel';
import { useAuthStore } from '../auth/authStore';
import MyListingsSection from './MyListingsSection';

type EditableRole = 'utilisateur' | 'agence';

const ROLE_LABELS: Record<EditableRole, string> = {
  utilisateur: 'Particulier',
  agence: 'Agence',
};

// Champs du profil qui, s'ils changent côté serveur (par exemple depuis
// l'application Flutter), mettent la session à jour.
function sameProfile(a: UserProfile | null, b: Partial<UserProfile>): boolean {
  return (
    a !== null &&
    a.nom === b.nom &&
    a.telephone === b.telephone &&
    a.photoUrl === b.photoUrl &&
    a.role === b.role &&
    a.email === b.email
  );
}

// Écran de profil (F2) : nom, photo, téléphone, type de compte, annonces,
// notifications et déconnexion.
export default function ProfileScreen() {
  const uid = useAuthStore(state => state.uid);
  if (!uid) {
    return (
      <GuestGate
        title="Mon profil"
        message="Vous consultez ImmoTN en tant que visiteur. Connectez-vous pour gérer votre profil et vos annonces."
      />
    );
  }
  return <ProfileBody uid={uid} />;
}

function ProfileBody({ uid }: { uid: string }) {
  const navigation = useAppNavigation();
  const profile = useAuthStore(state => state.profile);
  const saveProfile = useAuthStore(state => state.saveProfile);
  const changePhoto = useAuthStore(state => state.changePhoto);
  const logout = useAuthStore(state => state.logout);

  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [role, setRole] = useState<EditableRole>('utilisateur');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isAdmin = profile?.role === 'admin';

  // Profil en temps réel : une modification faite depuis l'autre application
  // (Flutter) apparaît ici sans redémarrage.
  useEffect(() => {
    return watchUserProfile(uid, live => {
      if (!live) {
        return;
      }
      const current = useAuthStore.getState().profile;
      if (current !== null && !sameProfile(current, live)) {
        useAuthStore.setState({ profile: { ...current, ...live } });
      }
    });
  }, [uid]);

  useEffect(() => {
    if (profile) {
      setNom(profile.nom);
      setTelephone(profile.telephone);
      if (profile.role !== 'admin') {
        setRole(profile.role);
      }
    }
  }, [profile]);

  const save = async () => {
    setError(null);
    setMessage(null);
    const problem = validateRequiredName(nom) ?? validatePhone(telephone);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await saveProfile({
        nom,
        telephone,
        role: isAdmin ? undefined : role,
      });
      setMessage('Profil enregistré.');
    } catch {
      setError("Impossible d'enregistrer le profil. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async () => {
    setError(null);
    setMessage(null);
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.7,
      maxWidth: 1024,
      maxHeight: 1024,
    });
    const uri = result.assets?.[0]?.uri;
    if (!uri) {
      return;
    }
    setUploading(true);
    try {
      await changePhoto(uri);
    } catch {
      setError("Impossible d'envoyer la photo. Réessayez.");
    } finally {
      setUploading(false);
    }
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Profil introuvable.</Text>
        <LinkButton title="Se déconnecter" onPress={logout} />
      </View>
    );
  }

  // Repli sur la photo du compte (Google) si le profil n'en a pas.
  const photoUrl = profile.photoUrl || getCurrentAuthInfo().photoUrl || '';
  const created = toDate(profile.dateCreation);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mon profil</Text>

      <Pressable accessibilityRole="button" onPress={pickPhoto}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={styles.text}>Ajouter une photo</Text>
          </View>
        )}
      </Pressable>
      <LinkButton
        title={uploading ? 'Envoi de la photo…' : 'Changer la photo'}
        onPress={pickPhoto}
      />

      <Text style={styles.label}>Email</Text>
      <Text style={styles.text}>{profile.email}</Text>

      {created ? (
        <>
          <Text style={styles.label}>Membre depuis</Text>
          <Text style={styles.text}>{formatDate(created)}</Text>
        </>
      ) : null}

      <Text style={styles.label}>Nom</Text>
      <FormInput
        placeholder="Nom"
        autoCapitalize="words"
        value={nom}
        onChangeText={setNom}
      />

      <Text style={styles.label}>Téléphone</Text>
      <FormInput
        placeholder="Téléphone (facultatif)"
        keyboardType="phone-pad"
        value={telephone}
        onChangeText={setTelephone}
      />

      {isAdmin ? (
        <>
          <Text style={styles.label}>Type de compte</Text>
          <Text style={styles.text}>Administrateur</Text>
        </>
      ) : (
        <>
          <Text style={styles.label}>Type de compte</Text>
          <View style={styles.roleRow}>
            {(Object.keys(ROLE_LABELS) as EditableRole[]).map(key => (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ selected: role === key }}
                onPress={() => setRole(key)}
                style={[styles.roleOption, role === key && styles.roleSelected]}>
                <Text
                  style={role === key ? styles.roleSelectedText : styles.text}>
                  {ROLE_LABELS[key]}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <ErrorText message={error} />
      {message ? <Text style={styles.text}>{message}</Text> : null}
      <PrimaryButton title="Enregistrer" onPress={save} loading={saving} />

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Notifications')}
        style={styles.linkRow}>
        <Text style={styles.linkRowText}>🔔  Notifications</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <MyListingsSection uid={uid} />

      <LinkButton title="Se déconnecter" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  label: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  text: {
    color: colors.text,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
  },
  photoPlaceholder: {
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  roleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleSelectedText: {
    color: colors.background,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  linkRowText: { color: colors.text, fontSize: 15 },
  chevron: { color: colors.muted, fontSize: 22 },
});
