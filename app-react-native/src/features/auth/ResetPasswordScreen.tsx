import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing } from '../../core/theme';
import { validateEmail } from '../../core/validators';
import {
  ErrorText,
  FormInput,
  LinkButton,
  PrimaryButton,
} from '../../core/ui';
import {
  authErrorMessage,
  requestPasswordReset,
} from '../../data/authService';
import type { AuthStackParamList } from './types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const validation = validateEmail(email);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Réinitialiser le mot de passe</Text>
      <FormInput
        placeholder="Email"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <ErrorText message={error} />
      {sent ? (
        <Text style={styles.success}>
          Si un compte existe avec cet email, un message de réinitialisation
          vient d'être envoyé.
        </Text>
      ) : null}
      <PrimaryButton
        title="Envoyer le lien"
        onPress={submit}
        loading={loading}
      />
      <LinkButton
        title="Retour à la connexion"
        onPress={() => navigation.navigate('Login')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  success: {
    color: colors.text,
  },
});
