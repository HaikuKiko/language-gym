import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { BusyOverlay } from '@/core/ui/busy-overlay';
import { Button } from '@/core/ui/button';
import { ThemedText } from '@/core/ui/themed-text';
import { Spacing } from '@/core/ui/theme';
import { useTheme } from '@/core/ui/use-theme';
import { emailLink, shareReport } from '@/lib/share-report';

type Status = 'idle' | 'copied' | 'failed' | 'saved' | 'needs-tap' | 'pdf-failed' | 'print-failed';

/**
 * "Share report" with three choices: a PDF that looks like the screen (sent
 * through the share menu to Teams, Outlook, WhatsApp …, or saved on a
 * computer), the print page (which can also save a PDF), or plain text.
 * Apps outside the browser get the plain-text share only.
 */
export function ShareReportButton({
  title,
  report,
  html,
  pdfName = 'feedback-report',
}: {
  title: string;
  /** The plain-text report. */
  report: () => string;
  /** The report as HTML (report-html.ts), for the PDF and printing. */
  html?: () => string;
  pdfName?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [making, setMaking] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const ready = useRef<{ pdf: Blob; filename: string } | null>(null);
  const web = Platform.OS === 'web' && !!html;

  async function shareText() {
    const outcome = await shareReport(title, report());
    setStatus(outcome === 'copied' ? 'copied' : outcome === 'failed' ? 'failed' : 'idle');
  }

  async function sendPdf(pdf: Blob, filename: string) {
    const { shareOrSavePdf } = await import('@/lib/report-pdf');
    const outcome = await shareOrSavePdf(pdf, filename, title);
    if (outcome === 'needs-tap') {
      ready.current = { pdf, filename };
      setStatus('needs-tap');
    } else {
      ready.current = null;
      setStatus(outcome === 'saved' ? 'saved' : outcome === 'failed' ? 'pdf-failed' : 'idle');
    }
  }

  async function sharePdf() {
    if (!html) return;
    setStatus('idle');
    setMaking(true);
    try {
      const { makeReportPdf, reportFilename } = await import('@/lib/report-pdf');
      const pdf = await makeReportPdf(html());
      setMaking(false);
      await sendPdf(pdf, reportFilename(pdfName));
    } catch (e) {
      console.error('PDF failed', e);
      setMaking(false);
      setStatus('pdf-failed');
    }
  }

  async function print() {
    if (!html) return;
    setStatus('idle');
    const { printReport } = await import('@/lib/report-pdf');
    if (!printReport(title, html())) setStatus('print-failed');
  }

  if (!web) {
    return (
      <View style={styles.box}>
        <Button label="Share report" variant="secondary" onPress={shareText} />
        <TextStatus status={status} title={title} report={report} />
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Button label={open ? 'Share report ▴' : 'Share report ▾'} variant="secondary" onPress={() => setOpen(!open)} />
      {open && (
        <View style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}>
          <Option
            icon="📄"
            title="Share as PDF"
            detail="Looks like this screen. Teams, Outlook, WhatsApp … (on a computer it is saved to Downloads)"
            onPress={sharePdf}
          />
          <Option icon="🖨️" title="Print" detail="Opens the print page (you can also “Save as PDF” there)" onPress={print} />
          <Option icon="📋" title="Copy as text" detail="Plain text to paste anywhere" onPress={shareText} />
        </View>
      )}
      {status === 'needs-tap' && ready.current && (
        <Button label="The PDF is ready: tap to share it" onPress={() => sendPdf(ready.current!.pdf, ready.current!.filename)} />
      )}
      {status === 'saved' && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          The PDF was saved to your Downloads. Attach it in Teams or Outlook.
        </ThemedText>
      )}
      {status === 'pdf-failed' && (
        <ThemedText type="small" themeColor="warning" style={styles.centered}>
          We couldn&apos;t make the PDF here. Try Print, or Copy as text.
        </ThemedText>
      )}
      {status === 'print-failed' && (
        <ThemedText type="small" themeColor="warning" style={styles.centered}>
          Printing isn&apos;t available here. Try Share as PDF.
        </ThemedText>
      )}
      <TextStatus status={status} title={title} report={report} />
      <BusyOverlay visible={making} title="Making the PDF…" detail="This takes a few seconds." />
    </View>
  );
}

function Option({ icon, title, detail, onPress }: { icon: string; title: string; detail: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.option, { backgroundColor: theme.background, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
        <ThemedText style={styles.iconText}>{icon}</ThemedText>
      </View>
      <View style={styles.optionBody}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function TextStatus({ status, title, report }: { status: Status; title: string; report: () => string }) {
  if (status === 'copied') {
    return (
      <View style={styles.box}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Report copied. Paste it into Teams, Outlook or anywhere else.
        </ThemedText>
        <Button label="Open it in an email" variant="secondary" onPress={() => Linking.openURL(emailLink(title, report()))} />
      </View>
    );
  }
  if (status === 'failed') {
    return (
      <ThemedText type="small" themeColor="warning" style={styles.centered}>
        Sharing isn&apos;t available here. Try again on a phone.
      </ThemedText>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
  sheet: {
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 20,
    lineHeight: 26,
  },
  optionBody: {
    flex: 1,
    gap: 2,
  },
});
