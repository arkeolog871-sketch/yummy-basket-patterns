import * as React from "react";

import { Body, Container, Head, Heading, Hr, Html, Link, Text } from "@react-email/components";

import { formatOtpToken } from "@/lib/otp";

export const brand = {
  primary: "#f0913f",
  primaryDark: "#c96a1c",
  accent: "#e0452b",
  ink: "#2b1c10",
  muted: "#6b5a4c",
  surface: "#fff8ef",
  border: "#f0dcc4",
};

export const styles = {
  main: { backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" },
  container: { padding: "24px", maxWidth: "560px" },
  card: {
    backgroundColor: brand.surface,
    border: `1px solid ${brand.border}`,
    borderRadius: "16px",
    padding: "28px 24px",
  },
  brandName: {
    fontSize: "13px",
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    color: brand.primaryDark,
    fontWeight: "bold" as const,
    margin: "0 0 12px",
  },
  h1: {
    fontSize: "22px",
    fontWeight: "bold" as const,
    color: brand.ink,
    margin: "0 0 16px",
  },
  text: {
    fontSize: "15px",
    color: brand.muted,
    lineHeight: "1.6",
    margin: "0 0 18px",
  },
  code: {
    display: "block",
    fontSize: "30px",
    fontWeight: "bold" as const,
    letterSpacing: "8px",
    color: brand.ink,
    backgroundColor: "#ffffff",
    border: `2px dashed ${brand.primary}`,
    borderRadius: "12px",
    padding: "16px 12px",
    textAlign: "center" as const,
    margin: "0 0 18px",
  },
  button: {
    backgroundColor: brand.primary,
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "bold" as const,
    borderRadius: "10px",
    padding: "13px 22px",
    textDecoration: "none",
    display: "inline-block",
  },
  link: { color: brand.accent, textDecoration: "underline" },
  hr: { borderColor: brand.border, margin: "24px 0 16px" },
  footer: { fontSize: "12px", color: "#9a8b7d", margin: "0" },
};

/** Tüm kimlik doğrulama e-postaları için ortak marka çerçevesi. */
export const EmailShell = ({
  siteName,
  children,
}: {
  siteName: string;
  children: React.ReactNode;
}) => (
  <Html lang="tr" dir="ltr">
    <Head />
    <Body style={styles.main}>
      <Container style={styles.container}>
        <div style={styles.card}>
          <Text style={styles.brandName}>{siteName}</Text>
          {children}
        </div>
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          Bu e-posta {siteName} tarafından gönderildi. Bu isteği siz yapmadıysanız e-postayı
          yok sayabilirsiniz.
        </Text>
      </Container>
    </Body>
  </Html>
);

/** 6 haneli doğrulama kodunu gösterir; kod yoksa hiçbir şey basmaz. */
export const CodeBox = ({ token }: { token?: string | undefined }) => {
  const digits = formatOtpToken(token);
  if (!digits) return null;
  return (
    <>
      <Text style={styles.text}>Doğrulama kodunuz:</Text>
      <Text style={{ ...styles.code, letterSpacing: digits.length > 6 ? "4px" : "8px" }}>
        {digits}
      </Text>
    </>
  );
};

export const FallbackLink = ({ url }: { url: string }) => (
  <Text style={{ ...styles.text, fontSize: "12px", wordBreak: "break-all" as const }}>
    Buton çalışmazsa bu bağlantıyı kullanın:{" "}
    <Link href={url} style={styles.link}>
      {url}
    </Link>
  </Text>
);

export const Title = ({ children }: { children: React.ReactNode }) => (
  <Heading style={styles.h1}>{children}</Heading>
);
