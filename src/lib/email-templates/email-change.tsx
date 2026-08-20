import * as React from "react";

import { Button, Preview } from "@react-email/components";

import { CodeBox, EmailShell, FallbackLink, Title, styles } from "./brand";

interface EmailChangeEmailProps {
  siteName: string;
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
  token?: string | undefined;
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
  token,
}: EmailChangeEmailProps) => (
  <>
    <Preview>{siteName} e-posta değişikliğini onaylayın</Preview>
    <EmailShell siteName={siteName}>
      <Title>E-posta değişikliğini onaylayın</Title>
      <p style={styles.text}>
        Hesabınızın e-posta adresi <strong>{oldEmail}</strong> yerine{" "}
        <strong>{newEmail}</strong> olarak güncellenecek.
      </p>
      <CodeBox token={token} />
      <p style={styles.text}>Onaylamak için aşağıdaki butona dokunun. Kod 10 dakika geçerlidir.</p>
      <Button style={styles.button} href={confirmationUrl}>
        Değişikliği onayla
      </Button>
      <FallbackLink url={confirmationUrl} />
    </EmailShell>
  </>
);

export default EmailChangeEmail;
