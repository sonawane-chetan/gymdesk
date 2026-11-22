/**
 * n8n Gym Manager Automation — WhatsApp Cloud API Studio & Template Linter
 * Protects gyms from paying 7.5x extra by detecting promotional keywords
 * Based on Chapter 2, 5, and 8 of Sachin Prajapati's Guide
 */

const Linter = (function() {

  // Promotional keywords that trigger Meta to reclassify Utility (₹0.115) into Marketing (₹0.86)
  const bannedKeywords = [
    'offer', 'discount', 'free', 'off', 'deal', 'special price',
    'sale', 'flat', 'cashback', 'coupon', 'promo', 'save', 'trial',
    'bogo', 'best price', 'loot', 'festive'
  ];

  function lintTemplateText(text) {
    const lower = text.toLowerCase();
    const foundKeywords = [];

    bannedKeywords.forEach(kw => {
      // Word boundary match
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(lower)) {
        foundKeywords.push(kw);
      }
    });

    const hasNameVar = text.includes('{{1}}') || text.includes('{{name}}');
    const hasExpiryVar = text.includes('{{2}}') || text.includes('{{expiry_date}}');

    const isUtility = foundKeywords.length === 0;

    return {
      text,
      isUtility,
      category: isUtility ? 'Utility (Permitted)' : 'Marketing (Cost Risk!)',
      costPerMsg: isUtility ? 0.115 : 0.86,
      foundKeywords,
      hasNameVar,
      hasExpiryVar
    };
  }

  function init() {
    const textarea = document.getElementById('template-input-text');
    const previewContainer = document.getElementById('template-preview-text');
    const badgeCategory = document.getElementById('template-badge-category');
    const badgeCost = document.getElementById('template-badge-cost');
    const feedbackList = document.getElementById('template-feedback-list');

    if (!textarea) return;

    function runLint() {
      const text = textarea.value;
      const res = lintTemplateText(text);

      // Render live preview with highlighted variables
      let rendered = text
        .replace(/\{\{1\}\}|\{\{name\}\}/g, '<span class="text-emerald-300 font-bold bg-emerald-950 px-1 rounded">Rohit Kumar</span>')
        .replace(/\{\{2\}\}|\{\{expiry_date\}\}/g, '<span class="text-amber-300 font-bold bg-amber-950 px-1 rounded">2026-12-01</span>');

      if (previewContainer) {
        previewContainer.innerHTML = rendered || '<span class="text-slate-500 italic">Enter template text to preview...</span>';
      }

      // Update Category Badge
      if (badgeCategory) {
        if (res.isUtility) {
          badgeCategory.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
          badgeCategory.innerText = 'Category: Utility (~₹0.115 / msg)';
        } else {
          badgeCategory.className = 'px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40';
          badgeCategory.innerText = 'Warning: Marketing (~₹0.86 / msg)';
        }
      }

      if (badgeCost) {
        badgeCost.innerText = `₹${res.costPerMsg.toFixed(3)} + GST`;
      }

      // Feedback explanations
      if (feedbackList) {
        let feedbackHtml = '';
        if (res.foundKeywords.length > 0) {
          feedbackHtml += `
            <div class="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300 space-y-1">
              <div class="font-bold flex items-center gap-1.5 text-red-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                Promotional words detected: ${res.foundKeywords.map(k => `"${k}"`).join(', ')}
              </div>
              <p>Meta AI will automatically classify this as Marketing, causing you to pay <strong>₹0.86 instead of ₹0.115</strong> (7.5x higher!). Remove these words to keep it Utility.</p>
            </div>
          `;
        } else {
          feedbackHtml += `
            <div class="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
              <div class="font-bold text-emerald-400 flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                100% Utility Compliant
              </div>
              <p>Strictly informational reminder text. Qualifies for Meta's lowest Utility rate card.</p>
            </div>
          `;
        }
        feedbackList.innerHTML = feedbackHtml;
      }
    }

    textarea.addEventListener('input', runLint);
    runLint();

    // Template preset buttons
    const presetBtnHindi = document.getElementById('btn-preset-template-hi');
    const presetBtnEnglish = document.getElementById('btn-preset-template-en');

    if (presetBtnHindi) {
      presetBtnHindi.addEventListener('click', () => {
        textarea.value = `Namaste {{1}}, aapki gym membership {{2}} ko khatam ho rahi hai. Renew karne ke liye gym par aayein ya hamse sampark karein. Dhanyavaad!`;
        runLint();
      });
    }

    if (presetBtnEnglish) {
      presetBtnEnglish.addEventListener('click', () => {
        textarea.value = `Hello {{1}}, your gym membership is expiring on {{2}}. Please visit the front desk or renew online to continue your workouts uninterrupted. Thank you!`;
        runLint();
      });
    }
  }

  const api = {
    init,
    lintTemplateText
  };

  window.Linter = api;
  return api;
})();
