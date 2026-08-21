import * as React from "react";

import { Preview } from "@react-email/components";

import { CodeBox, EmailShell, Title, styles } from "./brand";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
  token?: string | undefined;
}

export const SignupEmail = ({ siteName, recipient, token }: SignupEmailProps) => (
  <>
    <Preview>{siteName} doğrulama kodunuz</Preview>
    <EmailShell siteName={siteName}>
      <Title>Hesabınızı doğrulayın</Title>
      <p style={styles.text}>
        Merhaba, <strong>{recipient}</strong> adresiyle {siteName} hesabı oluşturdunuz.
      </p>
      <CodeBox token={token} />
      <p style={styles.text}>
        Bu 6 haneli kodu uygulamadaki doğrulama ekranına girin. Kod 10 dakika geçerlidir ve yalnızca
        bir kez kullanılabilir. Kodu kimseyle paylaşmayın.
      </p>
    </EmailShell>
  </>
);

export default SignupEmail;
