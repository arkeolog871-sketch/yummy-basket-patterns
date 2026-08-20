import * as React from "react";

import { Button, Preview } from "@react-email/components";

import { CodeBox, EmailShell, FallbackLink, Title, styles } from "./brand";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
  token?: string;
}

export const SignupEmail = ({
  siteName,
  recipient,
  confirmationUrl,
  token,
}: SignupEmailProps) => (
  <>
    <Preview>{siteName} hesabınızı doğrulayın</Preview>
    <EmailShell siteName={siteName}>
      <Title>Hesabınızı doğrulayın</Title>
      <p style={styles.text}>
        Merhaba, <strong>{recipient}</strong> adresiyle {siteName} hesabı oluşturdunuz.
      </p>
      <CodeBox token={token} />
      <p style={styles.text}>
        Kodu uygulamaya girebilir ya da aşağıdaki butonla doğrudan doğrulayabilirsiniz. Kod 10
        dakika geçerlidir.
      </p>
      <Button style={styles.button} href={confirmationUrl}>
        E-postamı doğrula
      </Button>
      <FallbackLink url={confirmationUrl} />
    </EmailShell>
  </>
);

export default SignupEmail;
