import * as React from "react";

import { Button, Preview } from "@react-email/components";

import { EmailShell, FallbackLink, Title, styles } from "./brand";

interface InviteEmailProps {
  siteName: string;
  siteUrl: string;
  confirmationUrl: string;
}

export const InviteEmail = ({ siteName, confirmationUrl }: InviteEmailProps) => (
  <>
    <Preview>{siteName} davetiniz</Preview>
    <EmailShell siteName={siteName}>
      <Title>{siteName} ekibine davet edildiniz</Title>
      <p style={styles.text}>
        Hesabınızı etkinleştirmek ve şifrenizi belirlemek için aşağıdaki butona dokunun.
      </p>
      <Button style={styles.button} href={confirmationUrl}>
        Daveti kabul et
      </Button>
      <FallbackLink url={confirmationUrl} />
    </EmailShell>
  </>
);

export default InviteEmail;
