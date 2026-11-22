/**
 * n8n Gym Manager Automation — Revenue Leak & ROI Calculator
 * Based on Chapter 1, 2, and 9 of Sachin Prajapati's Guide
 */

const Calculator = (function() {
  function calculate(members, fee, setupCost = 12000) {
    const totalMembers = parseInt(members, 10) || 130;
    const monthlyFee = parseInt(fee, 10) || 1200;
    const setupFee = parseInt(setupCost, 10) || 12000;

    // Benchmarks from Sachin's guide
    const monthlyGrossRevenue = totalMembers * monthlyFee;
    const monthlyExpiringRate = 0.30; // ~30-40 members expire per month in a 130-member gym
    const monthlyExpiringMembers = Math.round(totalMembers * monthlyExpiringRate);

    // Without automation, 20% of expiring members slip through the cracks without renewal
    const leakRate = 0.20;
    const lostMembersMonthly = Math.max(1, Math.round(monthlyExpiringMembers * leakRate));
    const monthlyLeakedRevenue = lostMembersMonthly * monthlyFee;

    // With automated WhatsApp reminders (T-3, T-0), 85% of expiring members renew promptly
    const recoveredMembersMonthly = Math.round(lostMembersMonthly * 0.85);
    const monthlyRecoveredRevenue = recoveredMembersMonthly * monthlyFee;
    const annualRecoveredRevenue = monthlyRecoveredRevenue * 12;

    // WhatsApp Cloud API Utility Cost:
    // Avg 2 messages per expiring member * ₹0.115 + GST
    const monthlyMessages = monthlyExpiringMembers * 2;
    const monthlyWhatsAppCost = Math.ceil(monthlyMessages * 0.115 * 1.18); // with 18% GST

    // Payback period in days
    const dailyRecovered = monthlyRecoveredRevenue / 30;
    const paybackDays = dailyRecovered > 0 ? Math.ceil(setupFee / dailyRecovered) : 0;
    const roiPercentage = monthlyRecoveredRevenue > 0 ? Math.round(((annualRecoveredRevenue - setupFee) / setupFee) * 100) : 0;

    return {
      totalMembers,
      monthlyFee,
      setupFee,
      monthlyGrossRevenue,
      monthlyExpiringMembers,
      lostMembersMonthly,
      monthlyLeakedRevenue,
      recoveredMembersMonthly,
      monthlyRecoveredRevenue,
      annualRecoveredRevenue,
      monthlyWhatsAppCost,
      paybackDays,
      roiPercentage
    };
  }

  function init() {
    const membersSlider = document.getElementById('calc-members');
    const feeSlider = document.getElementById('calc-fee');
    const setupInput = document.getElementById('calc-setup');

    if (!membersSlider || !feeSlider) return;

    function updateView() {
      const members = membersSlider.value;
      const fee = feeSlider.value;
      const setup = setupInput ? setupInput.value : 12000;

      const res = calculate(members, fee, setup);

      // Update slider badge labels
      const membersVal = document.getElementById('calc-members-val');
      const feeVal = document.getElementById('calc-fee-val');
      if (membersVal) membersVal.innerText = res.totalMembers;
      if (feeVal) feeVal.innerText = '₹' + res.monthlyFee.toLocaleString('en-IN');

      // Update outputs
      const leakOutput = document.getElementById('calc-monthly-leak');
      const recoveredOutput = document.getElementById('calc-monthly-recovered');
      const annualOutput = document.getElementById('calc-annual-recovered');
      const paybackOutput = document.getElementById('calc-payback-days');
      const waCostOutput = document.getElementById('calc-wa-cost');
      const roiOutput = document.getElementById('calc-roi-badge');

      if (leakOutput) leakOutput.innerText = '₹' + res.monthlyLeakedRevenue.toLocaleString('en-IN') + '/mo';
      if (recoveredOutput) recoveredOutput.innerText = '₹' + res.monthlyRecoveredRevenue.toLocaleString('en-IN') + '/mo';
      if (annualOutput) annualOutput.innerText = '₹' + res.annualRecoveredRevenue.toLocaleString('en-IN');
      if (paybackOutput) paybackOutput.innerText = res.paybackDays + ' Days';
      if (waCostOutput) waCostOutput.innerText = '₹' + res.monthlyWhatsAppCost + '/mo';
      if (roiOutput) roiOutput.innerText = '+' + res.roiPercentage + '% 1st Year ROI';
    }

    membersSlider.addEventListener('input', updateView);
    feeSlider.addEventListener('input', updateView);
    if (setupInput) setupInput.addEventListener('input', updateView);

    // Initial calculation
    updateView();
  }

  const api = {
    calculate,
    init
  };

  window.Calculator = api;
  return api;
})();
