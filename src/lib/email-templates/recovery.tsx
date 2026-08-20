import * as React from "react";

import { Button, Preview } from "@react-email/components";

import { CodeBox, EmailShell, FallbackLink, Title, styles } from "./brand";

interface RecoveryEmailProps {
  siteName: string;
  confirmationUrl: string;
  token?: string;
}

export const RecoveryEmail = ({ siteName, confirmationUrl, token }: RecoveryEmailProps) => (
  <>
    <Preview>{siteName} şifre sıfırlama</Preview>
    <EmailShell siteName={siteName}>
      <Title>Şifrenizi sıfırlayın</Title>
      <p style={styles.text}>Şifre sıfırlama talebiniz için doğrulama bilgileriniz aşağıda.</p>
      <CodeBox token={token} />
      <p style={styles.text}>
        Aşağıdaki butonla yeni şifrenizi belirleyebilirsiniz. Bağlantı ve kod 10 dakika
        geçerlidir; süre dolarsa yeni kod isteyin.
      </p>
      <Button style={styles.button} href={confirmationUrl}>
        Yeni şifre belirle
      </Button>
      <FallbackLink url={confirmationUrl} />
    </EmailShell>
  </>
);

export default RecoveryEmail;
