'use strict';
/* ════════════════════════════════════════════════════════════════════
   Who sells EIMC: printed on every invoice and on the legal and
   contact pages. FILL THESE IN before taking real payments: Razorpay's
   website review and GST invoices both need the real legal name and
   address. Anything left empty is simply not shown.
   ════════════════════════════════════════════════════════════════════ */

export const BUSINESS = {
  brand: 'EIMC Terminal',
  legalName: '',              // e.g. "EIMC Technologies" or your name as registered with GST / Razorpay
  address: '',                // registered address, one line: "12 Example Road, Surat, Gujarat 395007"
  state: '',                  // the state in that address, e.g. "Gujarat" (decides CGST+SGST or IGST on invoices)
  gstin: '',                  // 15 characters, once GST-registered
  email: 'support@eimc.app',
  phone: '',                  // a number customers may call or WhatsApp, e.g. "+91 98xxxxxxxx"
  hours: 'Mon–Sat, 9:00–18:00 IST',
  jurisdiction: '',           // city whose courts hear disputes, e.g. "Surat"
};
