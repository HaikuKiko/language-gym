import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { JoinCourse } from '@/components/join-course';
import { Pill } from '@/core/ui/pill';
import { Screen } from '@/core/ui/screen';
import { ErrorNote } from '@/core/ui/notice';
import { ThemedText } from '@/core/ui/themed-text';
import { ThemedView } from '@/core/ui/themed-view';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import {
  CODE_LENGTH,
  EMAIL_SIGN_IN,
  PIN_LENGTH,
  STUDENT_CODE_LENGTH,
  finishSaving,
  finishSignIn,
  isValidEmail,
  loadAccount,
  saveName,
  saveWithPin,
  signInWithPin,
  signOut,
  startSaving,
  startSignIn,
  usesPin,
  type Account,
} from '@/core/app/account';
import { errorMessage } from '@/core/app/supabase';

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
  const [pin, setPin] = useState('');
  const [studentCode, setStudentCode] = useState('');
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
    // Students arrive from a link: "Back" only goes back, never to the teacher page.
    router.canGoBack() ? <Button label="Back" variant="secondary" onPress={() => router.back()} /> : null
  );

  const messages = (
    <>
      <ErrorNote message={error} />
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
            {account.student.displayName}
            {account.email && !usesPin(account.email) ? ` · ${account.email}` : ''}
          </ThemedText>
        </View>

        <View style={[styles.codeCard, { backgroundColor: theme.hero }]}>
          <ThemedText type="smallBold" style={[styles.codeLabel, { color: theme.onHeroMuted }]}>
            YOUR STUDENT CODE
          </ThemedText>
          <ThemedText style={[styles.codeValue, { color: theme.onHero }]}>{account.student.studentCode}</ThemedText>
          <ThemedText type="small" style={[styles.centered, { color: theme.onHeroMuted }]}>
            {usesPin(account.email)
              ? 'Keep this code safe. Use it with your PIN to sign in on other devices.'
              : 'Keep this code safe. Your teacher can use it to find you.'}
          </ThemedText>
        </View>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Your courses</ThemedText>
          <View style={styles.courseRow}>
            <ThemedText style={styles.courseName}>General English</ThemedText>
            <Pill label="Open to all" />
          </View>
          {account.courses.map((course) => {
            const enrolment = account.enrolments.find((e) => e.trackId === course.id);
            return (
              <View key={course.id} style={styles.course}>
                <View style={styles.courseRow}>
                  <ThemedText style={styles.courseName}>{course.name}</ThemedText>
                  {enrolment ? (
                    <Pill label={enrolment.target ? `Target ${enrolment.target}` : 'Joined'} tone="accent" />
                  ) : !course.active ? (
                    <Pill label="Coming soon" />
                  ) : null}
                </View>
                {!enrolment && course.active && (
                  <JoinCourse trackId={course.id} trackName={course.name} onJoined={refresh} />
                )}
              </View>
            );
          })}
        </ThemedView>

        <View style={styles.section}>
          {account.enrolments.some((e) => e.trackId === 'ielts') && (
            <Button label="IELTS writing" onPress={() => router.push('/ielts')} />
          )}
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

  // ---- Prototype: student code + PIN, no email -----------------------------
  const pinInputProps = {
    keyboardType: 'number-pad' as const,
    inputMode: 'numeric' as const,
    secureTextEntry: true,
    maxLength: PIN_LENGTH,
    style: [inputStyle, styles.pinInput],
  };

  if (!EMAIL_SIGN_IN && step.kind === 'sign-in') {
    return (
      <Screen>
        <View style={styles.header}>
          <ThemedText type="subtitle">Sign in</ThemedText>
          <ThemedText themeColor="textSecondary">
            Use the student code and PIN you chose when you saved your account.
          </ThemedText>
        </View>
        <View style={styles.section}>
          <ThemedText type="smallBold">Student code</ThemedText>
          <TextInput
            value={studentCode}
            onChangeText={(text) => setStudentCode(text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, STUDENT_CODE_LENGTH))}
            accessibilityLabel="Student code"
            placeholder="For example K7Q2MX"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[inputStyle, styles.studentCodeInput]}
          />
          <ThemedText type="smallBold">PIN</ThemedText>
          <TextInput
            value={pin}
            onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, PIN_LENGTH))}
            accessibilityLabel="PIN"
            {...pinInputProps}
          />
          <Button
            label={busy ? 'Signing in…' : 'Sign in'}
            disabled={busy || studentCode.length !== STUDENT_CODE_LENGTH || pin.length !== PIN_LENGTH}
            onPress={() =>
              run(async () => {
                await signInWithPin(studentCode, pin);
                setPin('');
                setStep({ kind: 'save' });
                await refresh();
                if (params.next === 'ielts') router.replace('/ielts');
              })
            }
          />
          <Button label="I don't have a saved account yet" variant="secondary" onPress={() => setStep({ kind: 'save' })} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            Forgot your PIN? Ask your teacher.
          </ThemedText>
          {messages}
        </View>
        {back}
      </Screen>
    );
  }

  if (!EMAIL_SIGN_IN) {
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
          <ThemedText type="small">
            ✓ No email needed. You get a student code, and you choose a {PIN_LENGTH}-number PIN.
          </ThemedText>
          <ThemedText type="small">
            ✓ Sign in on any device with your student code and PIN.
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
          <ThemedText type="smallBold">Choose a {PIN_LENGTH}-number PIN</ThemedText>
          <TextInput
            value={pin}
            onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, PIN_LENGTH))}
            accessibilityLabel={`Choose a ${PIN_LENGTH}-number PIN`}
            {...pinInputProps}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Write your PIN down. You need it to sign in on another device.
          </ThemedText>
          <Button
            label={busy ? 'Saving…' : 'Save my account'}
            disabled={busy || !name.trim() || pin.length !== PIN_LENGTH}
            onPress={() =>
              run(async () => {
                await saveWithPin(name, pin);
                setPin('');
                await refresh();
                if (params.next === 'ielts') router.replace('/ielts');
              })
            }
          />
          {messages}
        </View>

        <View style={styles.section}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            Already saved on another device?
          </ThemedText>
          <Button label="Sign in with my code and PIN" variant="secondary" onPress={() => setStep({ kind: 'sign-in' })} />
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
  pinInput: {
    minHeight: 56,
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 12,
    textAlign: 'center',
  },
  studentCodeInput: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 4,
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
  course: {
    gap: Spacing.two,
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
