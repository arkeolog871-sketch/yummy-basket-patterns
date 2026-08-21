import * as React from "react";

import { Preview } from "@react-email/components";

import { CodeBox, EmailShell, Title, styles } from "./brand";

interface MagicLinkEmailProps {
  siteName: string;
  confirmationUrl: string;
  token?: string | undefined;
}

export const MagicLinkEmail = ({ siteName, token }: MagicLinkEmailProps) => (
  <>
    <Preview>{siteName} giriş kodunuz</Preview>
    <EmailShell siteName={siteName}>
      <Title>Giriş kodunuz</Title>
      <CodeBox token={token} />
      <p style={styles.text}>
        Bu 6 haneli kodu giriş ekranına yazın. Kod 10 dakika geçerlidir ve yalnızca bir kez
        kullanılabilir. Kodu kimseyle paylaşmayın.
      </p>
    </EmailShell>
  </>
);

export default MagicLinkEmail;
