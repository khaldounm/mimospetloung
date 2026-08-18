import {
  Document,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { CLINIC, INVOICE_TERMS } from "@/constants/clinic";
import { formatDate, formatDateTime, formatMoney } from "@/utils/format";
import type { InvoiceDTO } from "@/types/entities";

const COLORS = {
  text: "#1a1a1a",
  muted: "#666666",
  line: "#d0d0d0",
  headerBg: "#f4f4f5",
  accent: "#1976d2",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 9,
    color: COLORS.text,
    fontFamily: "Helvetica",
    lineHeight: 1.4,
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: COLORS.accent,
    textAlign: "center",
    marginBottom: 28,
  },
  headerBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  leftCol: { width: "52%" },
  rightCol: { width: "44%", alignItems: "flex-end" },
  logo: { marginBottom: 8 },
  muted: { color: COLORS.muted },
  metaBlock: { width: 184 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  metaLabel: { color: COLORS.muted },
  metaValue: { fontFamily: "Helvetica-Bold" },
  billTo: { marginTop: 16, alignItems: "flex-end" },
  sectionLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: "right",
  },
  bold: { fontFamily: "Helvetica-Bold" },
  table: { marginBottom: 16 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  colDesc: { width: "52%" },
  colQty: { width: "12%", textAlign: "right" },
  colUnit: { width: "18%", textAlign: "right" },
  colTotal: { width: "18%", textAlign: "right" },
  totals: { flexDirection: "row", justifyContent: "flex-end" },
  totalsBox: { width: "45%" },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    marginVertical: 4,
  },
  grandTotal: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: COLORS.headerBg,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  paymentsTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 22,
    marginBottom: 6,
  },
  notes: { marginTop: 22 },
  thanks: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  thanksText: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginLeft: 6,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingTop: 8,
    fontSize: 8,
    color: COLORS.muted,
  },
  pageNumber: { textAlign: "right", marginTop: 2 },
});

export default function InvoicePdfDocument({
  invoice,
  logoSrc = CLINIC.logo.src,
}: {
  invoice: InvoiceDTO;
  // Server-side rendering must pass an absolute URL; the browser default
  // (a root-relative path) only resolves in the client.
  logoSrc?: string;
}) {
  const discountAmount =
    (Number(invoice.subtotal) * Number(invoice.discountPct)) / 100;
  const hasDiscount = Number(invoice.discountPct) > 0;
  const hasTax = Number(invoice.taxPct) > 0;

  return (
    <Document
      title={`Invoice ${invoice.number}`}
      author={CLINIC.name}
      subject={`Invoice ${invoice.number} for ${invoice.clientName}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Centered title */}
        <Text style={styles.pageTitle}>INVOICE</Text>

        {/* Body: clinic identity (left) + invoice & client meta (right) */}
        <View style={styles.headerBody}>
          <View style={styles.leftCol}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image
              src={logoSrc}
              style={[
                styles.logo,
                { width: CLINIC.logo.width, height: CLINIC.logo.height },
              ]}
            />
            {CLINIC.addressLines.filter(Boolean).map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
            {CLINIC.phone ? (
              <Text style={styles.muted}>{CLINIC.phone}</Text>
            ) : null}
            {CLINIC.email ? (
              <Text style={styles.muted}>{CLINIC.email}</Text>
            ) : null}
            {CLINIC.website ? (
              <Text style={styles.muted}>{CLINIC.website}</Text>
            ) : null}
            {CLINIC.taxId ? (
              <Text style={[styles.muted, { marginTop: 4 }]}>
                {CLINIC.taxId}
              </Text>
            ) : null}
          </View>

          <View style={styles.rightCol}>
            <View style={styles.metaBlock}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Invoice no.</Text>
                <Text style={styles.metaValue}>{invoice.number}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Status</Text>
                <Text style={styles.metaValue}>{invoice.status}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Issue date</Text>
                <Text style={styles.metaValue}>
                  {invoice.issuedAt
                    ? formatDate(invoice.issuedAt.slice(0, 10))
                    : "Not issued"}
                </Text>
              </View>
              {invoice.dueDate ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Due date</Text>
                  <Text style={styles.metaValue}>
                    {formatDate(invoice.dueDate)}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.billTo}>
              <Text style={styles.sectionLabel}>Bill to</Text>
              <Text style={styles.bold}>{invoice.clientName}</Text>
              <Text style={styles.muted}>Client #{invoice.clientId}</Text>
            </View>
          </View>
        </View>

        {/* Line items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colUnit}>Unit price</Text>
            <Text style={styles.colTotal}>Amount</Text>
          </View>
          {invoice.lineItems.map((l) => (
            <View key={l.lineItemId} style={styles.tableRow}>
              <Text style={styles.colDesc}>{l.description}</Text>
              <Text style={styles.colQty}>{l.quantity}</Text>
              <Text style={styles.colUnit}>{formatMoney(l.unitPrice)}</Text>
              <Text style={styles.colTotal}>{formatMoney(l.lineTotal)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>Subtotal</Text>
              <Text>{formatMoney(invoice.subtotal)}</Text>
            </View>
            {hasDiscount ? (
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>
                  Discount ({invoice.discountPct}%)
                </Text>
                <Text>-{formatMoney(discountAmount)}</Text>
              </View>
            ) : null}
            {hasTax ? (
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>Tax ({invoice.taxPct}%)</Text>
                <Text>{formatMoney(invoice.taxAmount)}</Text>
              </View>
            ) : null}
            <View style={styles.totalsDivider} />
            <View style={styles.totalsRow}>
              <Text style={styles.grandTotal}>Total</Text>
              <Text style={styles.grandTotal}>
                {formatMoney(invoice.total)}
              </Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>Amount paid</Text>
              <Text>{formatMoney(invoice.amountPaid)}</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text>Balance due</Text>
              <Text>{formatMoney(invoice.balance)}</Text>
            </View>
          </View>
        </View>

        {/* Payment history (acts as a receipt once paid) */}
        {invoice.payments.length > 0 ? (
          <View>
            <Text style={styles.paymentsTitle}>Payments received</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ width: "30%" }}>Date</Text>
                <Text style={{ width: "25%" }}>Method</Text>
                <Text style={{ width: "27%" }}>Reference</Text>
                <Text style={{ width: "18%", textAlign: "right" }}>Amount</Text>
              </View>
              {invoice.payments.map((p) => (
                <View key={p.paymentId} style={styles.tableRow}>
                  <Text style={{ width: "30%" }}>
                    {formatDateTime(p.paidAt)}
                  </Text>
                  <Text style={{ width: "25%" }}>{p.method ?? "-"}</Text>
                  <Text style={{ width: "27%" }}>{p.reference ?? "-"}</Text>
                  <Text style={{ width: "18%", textAlign: "right" }}>
                    {formatMoney(p.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Notes */}
        {invoice.notes ? (
          <View style={styles.notes}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Closing thank-you */}
        <View style={styles.thanks}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="#d32f2f"
            />
          </Svg>
          <Text style={styles.thanksText}>Thank you for your visit</Text>
        </View>

        {/* Footer: terms + page number, fixed on every page */}
        <View style={styles.footer} fixed>
          <Text>{INVOICE_TERMS}</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `${CLINIC.name} | Invoice ${invoice.number} | Page ${pageNumber} of ${totalPages}`
            }
            fixed
          />
        </View>
      </Page>
    </Document>
  );
}
