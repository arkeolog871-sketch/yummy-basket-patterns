import * as React from "react";

import { Preview } from "@react-email/components";

import { CodeBox, EmailShell, Title, styles } from "./brand";

interface ReauthenticationEmailProps {
  token: string;
  siteName?: string;
}

export const ReauthenticationEmail = ({
  token,
  siteName = "SİLVAN CEBİMDE",
}: ReauthenticationEmailProps) => (
  <>
    <Preview>{siteName} doğrulama kodunuz</Preview>
    <EmailShell siteName={siteName}>
      <Title>Kimliğinizi doğrulayın</Title>
      <CodeBox token={token} />
      <p style={styles.text}>
        Bu kodu işlemi tamamlamak için uygulamaya girin. Kod 10 dakika geçerlidir ve yalnızca bir
        kez kullanılabilir.
      </p>
    </EmailShell>
  </>
);

export default ReauthenticationEmail;
