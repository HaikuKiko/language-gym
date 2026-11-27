import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Screen } from '@/core/ui/screen';
import { ThemedText } from '@/core/ui/themed-text';
import { PRODUCT_NAME, RETENTION_DAYS } from '@/constants/product';
import { SAVED_NAME_DAYS } from '@/core/live/saved-names';
import { Spacing } from '@/core/ui/theme';

/** The privacy page, in plain English. */
export default function PrivacyRoute() {
  return (
    <Screen>
      <ThemedText type="subtitle">Privacy</ThemedText>
      <ThemedText themeColor="textSecondary">
        {PRODUCT_NAME} is a speaking activity for classes and groups. We keep as little as possible, and only to run
        your sessions.
      </ThemedText>

      <Part title="What we store">
        <Line>
          The name you type when you join (a first name and the first letter of your family name, e.g. &quot;Mai
          T.&quot;, or a nickname).
        </Line>
        <Line>
          That name is also saved for the teacher or host, so next time you can type two letters and tap it. Only people
          joining that teacher&apos;s sessions see it, and only after typing its first letters.
        </Line>
        <Line>Which session you joined, and when.</Line>
        <Line>The session settings (level, theme, round length) chosen by the teacher or host.</Line>
        <Line>
          A random ID that your browser keeps, so that you stay in the session if you reload the page. It is not linked
          to your name in any other way.
        </Line>
        <Line>If you use the contact page: your email address and your message.</Line>
      </Part>

      <Part title="What we don't store">
        <Line>No accounts or passwords for students, no phone numbers, no location.</Line>
        <Line>No advertising, no tracking cookies, and we never sell or share data.</Line>
      </Part>

      <Part title="Who can see names">
        <Line>Only the teacher or host who ran the session and the other people in that session.</Line>
        <Line>
          Saved names: the teacher, and people joining that teacher&apos;s sessions who type the name&apos;s first
          letters.
        </Line>
      </Part>

      <Part title="Where it is kept">
        <Line>In a Supabase database in the European Union (Paris, France).</Line>
        <Line>
          The website is delivered by Cloudflare. Like every website, these services keep short technical logs (such as
          IP addresses) for security and to keep things running.
        </Line>
      </Part>

      <Part title="How long">
        <Line>Sessions, and the names in them, are deleted automatically after {RETENTION_DAYS} days.</Line>
        <Line>Saved names are deleted automatically after {SAVED_NAME_DAYS} days without use.</Line>
        <Line>Contact messages are kept until we have answered them, or until you ask us to delete them.</Line>
      </Part>

      <Part title="Young people">
        <Line>
          Some students are as young as 16. We suggest a first name and the first letter of the family name only, never
          a full name. Teachers: please ask your students to do the same.
        </Line>
      </Part>

      <Part title="Deleting your data, or asking a question">
        <Line>
          Use the contact page. To delete a session&apos;s names, tell us the session code and the name used, and we
          will delete them as soon as we can (and always within a month).
        </Line>
      </Part>

      <View style={styles.buttons}>
        <Button label="Contact us" onPress={() => router.push('/contact')} />
        <Button
          label="Back"
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </Screen>
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.part}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </View>
  );
}

function Line({ children }: { children: ReactNode }) {
  return (
    <View style={styles.line}>
      <ThemedText themeColor="textSecondary">•</ThemedText>
      <ThemedText style={styles.lineText}>{children}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  part: {
    gap: Spacing.one,
  },
  line: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  lineText: {
    flex: 1,
  },
  buttons: {
    gap: Spacing.two,
  },
});
