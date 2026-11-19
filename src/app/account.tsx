import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CODE_LENGTH,
  finishSaving,
  finishSignIn,
  isValidEmail,
  loadAccount,
  saveName,
  signOut,
  startSaving,
  startSignIn,
  type Account,
} from '@/lib/account';
import { errorMessage } from '@/lib/supabase';

type Step =
  | { kind: 'save' }
  | { kind: 'sign-in' }
  | { kind: 'code'; purpose: 'save' | 'sign-in'; email: string };

/**
 * Save my account: a guest adds their email (checked with a 6-digit code) so
 * their work follows them to any device, and gets a student code to give the
 * teacher. Saved students see their code and courses here.
 */
export default function AccountRoute() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ next?: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'save' });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }];

  const refresh = useCallback(async () => {
    try {
      const next = await loadAccount();
      setAccount(next);
      if (next.student) setName(next.student.displayName);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  const sendCode = (purpose: 'save' | 'sign-in') =>
    run(async () => {
      if (purpose === 'save') await startSaving(email);
      else await startSignIn(email);
      setCode('');
      setStep({ kind: 'code', purpose, email: email.trim() });
    });

  const checkCode = (purpose: 'save' | 'sign-in', address: string) =>
    run(async () => {
      if (purpose === 'save') await finishSaving(address, code, name);
      else await finishSignIn(address, code);
      setStep({ kind: 'save' });
      await refresh();
      if (params.next === 'ielts') router.replace('/ielts');
    });

  const back = (
    <Button label="Back" variant="secondary" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
  );

  const messages = (
    <>
      {error && (
        <ThemedText type="small" themeColor="warning" style={styles.centered}>
          {error}
        </ThemedText>
      )}
      {notice && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {notice}
        </ThemedText>
      )}
    </>
  );

  if (!account) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">{error ?? 'Loading your account…'}</ThemedText>
        {back}
      </Screen>
    );
  }

  // ---- Entering the code from the email -----------------------------------
  if (step.kind === 'code') {
    return (
      <Screen>
        <View style={styles.header}>
          <ThemedText type="subtitle">Check your email</ThemedText>
          <ThemedText themeColor="textSecondary">
            We sent a {CODE_LENGTH}-digit code to {step.email}. If you can&apos;t see it, look in your
            spam folder.
          </ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText type="smallBold">Code from the email</ThemedText>
          <TextInput
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            accessibilityLabel="Code from the email"
            keyboardType="number-pad"
            inputMode="numeric"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            onSubmitEditing={() => code.length === CODE_LENGTH && checkCode(step.purpose, step.email)}
            style={[inputStyle, styles.codeInput]}
          />
          <Button
            label={busy ? 'Checking…' : step.purpose === 'save' ? 'Save my account' : 'Sign in'}
            disabled={busy || code.length !== CODE_LENGTH}
            onPress={() => checkCode(step.purpose, step.email)}
          />
          <Button
            label="Send a new code"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              run(async () => {
                if (step.purpose === 'save') await startSaving(step.email);
                else await startSignIn(step.email);
                setNotice('A new code is on its way.');
              })
            }
          />
          <Button
            label="Use a different email"
            variant="secondary"
            disabled={busy}
            onPress={() => setStep({ kind: step.purpose === 'save' ? 'save' : 'sign-in' })}
          />
          {messages}
        </View>
      </Screen>
    );
  }

  // ---- A saved account ------------------------------------------------------
  if (!account.isGuest) {
    if (!account.student) {
      return (
        <Screen>
          <View style={styles.header}>
            <ThemedText type="subtitle">One more step</ThemedText>
            <ThemedText themeColor="textSecondary">
              Your account is saved. Type your name so your teacher knows it is you.
            </ThemedText>
          </View>
          <View style={styles.section}>
            <ThemedText type="smallBold">Your name</ThemedText>
            <TextInput value={name} onChangeText={setName} accessibilityLabel="Your name" maxLength={80} style={inputStyle} />
            <Button
              label={busy ? 'Saving…' : 'Save my name'}
              disabled={busy || !name.trim()}
              onPress={() => run(async () => {
                await saveName(name);
                await refresh();
              })}
            />
            {messages}
          </View>
          {back}
        </Screen>
      );
    }

    return (
      <Screen>
        <View style={styles.header}>
          <ThemedText type="subtitle">My account</ThemedText>
          <ThemedText themeColor="textSecondary">
            {account.student.displayName} · {account.email}
          </ThemedText>
        </View>

        <View style={[styles.codeCard, { backgroundColor: theme.hero }]}>
          <ThemedText type="smallBold" style={[styles.codeLabel, { color: theme.onHeroMuted }]}>
            YOUR STUDENT CODE
          </ThemedText>
          <ThemedText style={[styles.codeValue, { color: theme.onHero }]}>{account.student.studentCode}</ThemedText>
          <ThemedText type="small" style={[styles.centered, { color: theme.onHeroMuted }]}>
            Show this to your teacher. They will add you to your course.
          </ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Your courses</ThemedText>
          <View style={styles.courseRow}>
            <ThemedText style={styles.courseName}>General English</ThemedText>
            <Pill label="Open to all" />
          </View>
          {account.enrolments.map((e) => (
            <View key={e.trackId} style={styles.courseRow}>
              <ThemedText style={styles.courseName}>{e.trackName}</ThemedText>
              <Pill label={e.target ? `Target ${e.target}` : 'Enrolled'} tone="accent" />
            </View>
          ))}
          {account.enrolments.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Doing IELTS or Cambridge B2 First? Show your teacher your student code.
            </ThemedText>
          )}
        </ThemedView>

        <View style={styles.section}>
          {account.enrolments.some((e) => e.trackId === 'ielts') && (
            <Button label="IELTS writing" onPress={() => router.push('/ielts')} />
          )}
          <Button
            label="Check for new courses"
            variant="secondary"
            disabled={busy}
            onPress={() => run(refresh)}
          />
          <Button
            label="Sign out"
            variant="secondary"
            disabled={busy}
            onPress={() => run(async () => {
              await signOut();
              await refresh();
            })}
          />
          {messages}
          {back}
        </View>
      </Screen>
    );
  }

  // ---- Signing in on another device ---------------------------------------
  if (step.kind === 'sign-in') {
    return (
      <Screen>
        <View style={styles.header}>
          <ThemedText type="subtitle">Sign in with my email</ThemedText>
          <ThemedText themeColor="textSecondary">
            Use the email you saved your account with. We will send you a code.
          </ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText type="smallBold">Email</ThemedText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            accessibilityLabel="Email"
            placeholder="you@example.com"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            style={inputStyle}
          />
          <Button
            label={busy ? 'Sending…' : 'Send me a code'}
            disabled={busy || !isValidEmail(email)}
            onPress={() => sendCode('sign-in')}
          />
          <Button label="I don't have a saved account yet" variant="secondary" onPress={() => setStep({ kind: 'save' })} />
          {messages}
        </View>
        {back}
      </Screen>
    );
  }

  // ---- A guest saving their account ---------------------------------------
  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          IELTS · CAMBRIDGE B2 FIRST
        </ThemedText>
        <ThemedText type="subtitle">Save my account</ThemedText>
        <ThemedText themeColor="textSecondary">
          Save your account so your essays, bands and progress stay with you on any phone, tablet or
          computer.
        </ThemedText>
      </View>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small">✓ Everything you have done as a guest is kept.</ThemedText>
        <ThemedText type="small">✓ No password. We email you a {CODE_LENGTH}-digit code to sign in.</ThemedText>
        <ThemedText type="small">
          ✓ Your teacher uses your student code to add you to IELTS or B2 First.
        </ThemedText>
      </ThemedView>

      <View style={styles.section}>
        <ThemedText type="smallBold">Your name</ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          accessibilityLabel="Your name"
          placeholder="The name your teacher knows you by"
          placeholderTextColor={theme.textSecondary}
          maxLength={80}
          autoComplete="name"
          style={inputStyle}
        />
        <ThemedText type="smallBold">Email</ThemedText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email"
          placeholder="you@example.com"
          placeholderTextColor={theme.textSecondary}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          style={inputStyle}
        />
        <Button
          label={busy ? 'Sending…' : 'Send me a code'}
          disabled={busy || !name.trim() || !isValidEmail(email)}
          onPress={() => sendCode('save')}
        />
        {messages}
      </View>

      <View style={styles.section}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Already saved on another device?
        </ThemedText>
        <Button label="Sign in with my email" variant="secondary" onPress={() => setStep({ kind: 'sign-in' })} />
        {back}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    fontSize: 16,
  },
  codeInput: {
    minHeight: 60,
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: 8,
    textAlign: 'center',
  },
  codeCard: {
    padding: Spacing.four,
    borderRadius: 24,
    alignItems: 'center',
    gap: Spacing.one,
  },
  codeLabel: {
    letterSpacing: 1.5,
  },
  codeValue: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: 800,
    letterSpacing: 6,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  courseName: {
    flexShrink: 1,
  },
  centered: {
    textAlign: 'center',
  },
});
