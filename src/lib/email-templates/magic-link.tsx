import * as React from "react";

import { Button, Preview } from "@react-email/components";

import { CodeBox, EmailShell, FallbackLink, Title, styles } from "./brand";

interface MagicLinkEmailProps {
  siteName: string;
  confirmationUrl: string;
  token?: string;
}

export const MagicLinkEmail = ({ siteName, confirmationUrl, token }: MagicLinkEmailProps) => (
  <>
    <Preview>{siteName} giriş kodunuz</Preview>
    <EmailShell siteName={siteName}>
      <Title>Giriş kodunuz</Title>
      <CodeBox token={token} />
      <p style={styles.text}>
        Kodu giriş ekranına yazın veya aşağıdaki butonla tek tıkla giriş yapın. Kod 10 dakika
        geçerlidir.
      </p>
      <Button style={styles.button} href={confirmationUrl}>
        Giriş yap
      </Button>
      <FallbackLink url={confirmationUrl} />
    </EmailShell>
  </>
);

export default MagicLinkEmail;
