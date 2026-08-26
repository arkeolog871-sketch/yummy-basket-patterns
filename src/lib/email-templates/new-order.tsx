import * as React from "react";

import { Button, Preview } from "@react-email/components";

import { EmailShell, FallbackLink, Title, styles } from "./brand";

export type NewOrderEmailLine = {
  name: string;
  quantity: number;
  unitPriceLabel: string;
  lineTotalLabel: string;
};

export type NewOrderEmailProps = {
  siteName: string;
  restaurantName: string;
  dashboardUrl: string;
  createdAtLabel: string;
  recipientName: string;
  phone: string;
  address: string;
  note: string | null;
  lines: NewOrderEmailLine[];
  subtotalLabel: string;
  deliveryFeeLabel: string;
  totalLabel: string;
  paymentLabel: string;
};

export const NewOrderEmail = ({
  siteName,
  restaurantName,
  dashboardUrl,
  createdAtLabel,
  recipientName,
  phone,
  address,
  note,
  lines,
  subtotalLabel,
  deliveryFeeLabel,
  totalLabel,
  paymentLabel,
}: NewOrderEmailProps) => (
  <>
    <Preview>
      {restaurantName}: yeni sipariş — {totalLabel}
    </Preview>
    <EmailShell siteName={siteName}>
      <Title>Yeni sipariş</Title>
      <p style={styles.text}>
        <strong>{restaurantName}</strong> için yeni bir sipariş alındı. {createdAtLabel}
      </p>
      <p style={styles.text}>
        Teslimat: <strong>{recipientName}</strong>
        <br />
        Telefon: {phone}
        <br />
        Adres: {address}
      </p>
      <ul style={{ ...styles.text, paddingLeft: "18px" }}>
        {lines.map((line) => (
          <li key={`${line.name}-${line.quantity}`}>
            {line.quantity}× {line.name} — {line.lineTotalLabel}
          </li>
        ))}
      </ul>
      <p style={styles.text}>
        Ara toplam: {subtotalLabel}
        <br />
        Teslimat: {deliveryFeeLabel}
        <br />
        <strong>Toplam: {totalLabel}</strong>
        <br />
        Ödeme: {paymentLabel}
      </p>
      {note ? <p style={styles.text}>Not: {note}</p> : null}
      <Button style={styles.button} href={dashboardUrl}>
        Siparişi panelde aç
      </Button>
      <FallbackLink url={dashboardUrl} />
    </EmailShell>
  </>
);

export default NewOrderEmail;
