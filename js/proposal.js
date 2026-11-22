/**
 * n8n Gym Manager Automation — Client Proposal & Contract Generator
 * Generates ready-to-sign agreements with clear scope protection
 * Based on Chapter 9 (Page 22) of Sachin Prajapati's Guide
 */

const Proposal = (function() {

  function updateProposalView() {
    const gymName = document.getElementById('prop-gym-name')?.value || 'IronFit Gym';
    const ownerName = document.getElementById('prop-owner-name')?.value || 'Rajesh Sharma';
    const setupFee = document.getElementById('prop-setup-fee')?.value || '12000';
    const deliveryDays = document.getElementById('prop-delivery-days')?.value || '7';
    const supportDays = document.getElementById('prop-support-days')?.value || '14';
    const monthlyFee = document.getElementById('prop-monthly-fee')?.value || '1500';

    const sheetGym = document.getElementById('prop-preview-gym');
    const sheetOwner = document.getElementById('prop-preview-owner');
    const sheetFee = document.getElementById('prop-preview-fee');
    const sheetDays = document.getElementById('prop-preview-days');
    const sheetSupport = document.getElementById('prop-preview-support');
    const sheetMonthly = document.getElementById('prop-preview-monthly');
    const sheetDate = document.getElementById('prop-preview-date');

    if (sheetGym) sheetGym.innerText = gymName;
    if (sheetOwner) sheetOwner.innerText = ownerName;
    if (sheetFee) sheetFee.innerText = '₹' + Number(setupFee).toLocaleString('en-IN');
    if (sheetDays) sheetDays.innerText = deliveryDays + ' working days';
    if (sheetSupport) sheetSupport.innerText = supportDays + ' days';
    if (sheetMonthly) sheetMonthly.innerText = '₹' + Number(monthlyFee).toLocaleString('en-IN') + ' / month (optional)';
    if (sheetDate) sheetDate.innerText = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function printProposal() {
    window.print();
  }

  function copyProposalMarkdown() {
    const gymName = document.getElementById('prop-gym-name')?.value || 'IronFit Gym';
    const ownerName = document.getElementById('prop-owner-name')?.value || 'Rajesh Sharma';
    const setupFee = document.getElementById('prop-setup-fee')?.value || '12000';
    const deliveryDays = document.getElementById('prop-delivery-days')?.value || '7';
    const supportDays = document.getElementById('prop-support-days')?.value || '14';
    const monthlyFee = document.getElementById('prop-monthly-fee')?.value || '1500';

    const md = `**Gym Manager Automation: Official Proposal & Service Agreement**

**Client:** ${gymName} (Attn: ${ownerName})
**Date:** ${new Date().toLocaleDateString('en-IN')}

**1. Scope of Work (Deliverables):**
1. Automated Member Entry: Custom front-desk tablet form with auto-calculated expiry dates synced to your private Google Sheet.
2. WhatsApp Expiry Reminders: Automated 9:00 AM dispatch of Meta-approved utility templates at T-3 days and T-0 days before expiry.
3. Automated Payment Reconciliation: Instant status update to "Paid" via Razorpay webhook or manual front-desk entry form, with automated expiry extension.
4. Daily Owner Intelligence Digest: Automated 8:00 AM summary of Active members, Expired memberships, and Pending dues delivered to your WhatsApp/Email.
5. Google Sheet Architecture: 12-column database structure with formula-driven live owner dashboard.
6. Handover & Training: Complete credential handover and 30-minute front-desk staff onboarding.

**2. Exclusions (Out of Scope):**
- Custom website or native iOS/Android mobile apps.
- Biometric machine / turnstile / hardware access integration.
- Any manual data entry beyond initial member migration assistance.

**3. Financial Terms:**
- **One-time Setup Fee:** ₹${Number(setupFee).toLocaleString('en-IN')} (50% advance upon project initiation, 50% upon successful live test).
- **Optional Monthly Maintenance:** ₹${Number(monthlyFee).toLocaleString('en-IN')}/month (includes uptime monitoring and error fixes).
- **Running Costs:** Hosted directly on client's own accounts (n8n subscription or VPS, and Meta WhatsApp utility fees at ~₹0.115/message).

**4. Timeline & Warranty:**
- **Delivery Timeline:** ${deliveryDays} working days from receipt of WhatsApp Business credentials.
- **Post-Launch Warranty:** ${supportDays} days of free technical support and bug fixes.

---
**Accepted & Agreed:**

Client Signature: _______________________      Date: ______________
Automation Consultant: _________________      Date: ______________
`;

    navigator.clipboard.writeText(md).then(() => {
      if (window.Sandbox) {
        window.Sandbox.showToast('Copied proposal markdown to clipboard!', 'success');
      }
    });
  }

  function init() {
    const inputs = ['prop-gym-name', 'prop-owner-name', 'prop-setup-fee', 'prop-delivery-days', 'prop-support-days', 'prop-monthly-fee'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateProposalView);
    });

    const printBtn = document.getElementById('btn-print-proposal');
    const copyMdBtn = document.getElementById('btn-copy-proposal-md');

    if (printBtn) printBtn.addEventListener('click', printProposal);
    if (copyMdBtn) copyMdBtn.addEventListener('click', copyProposalMarkdown);

    updateProposalView();
  }

  const api = {
    init,
    printProposal,
    copyProposalMarkdown
  };

  window.Proposal = api;
  return api;
})();
