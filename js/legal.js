'use strict';
/* Legal and contact pages: fill in the seller's details from js/business.js.
   <span data-biz="legalName" data-fallback="EIMC">  -> the value, or the fallback
   <x data-biz-row="phone">                          -> removed when that value is empty */
import { BUSINESS } from '/js/business.js';

document.querySelectorAll('[data-biz]').forEach(n => {
  const v = String(BUSINESS[n.dataset.biz] || '').trim();
  n.textContent = v || n.dataset.fallback || '';
  if (n.tagName === 'A' && n.dataset.biz === 'email' && v) n.href = `mailto:${v}`;
  if (n.tagName === 'A' && n.dataset.biz === 'phone' && v) n.href = `tel:${v.replace(/[^\d+]/g, '')}`;
});
document.querySelectorAll('[data-biz-row]').forEach(n => {
  if (!String(BUSINESS[n.dataset.bizRow] || '').trim()) n.remove();
});
