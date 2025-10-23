export function classifyStatus(value, thresholds) {
  if (value == null) return 'warn';
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.warn) return 'warn';
  return 'bad';
}

export function psiStatus(score) {
  if (score == null) return 'warn';
  if (score >= 90) return 'good';
  if (score >= 50) return 'warn';
  return 'bad';
}

export function lcpStatus(lcp) {
  if (lcp == null) return 'warn';
  if (lcp <= 2.5) return 'good';
  if (lcp <= 4) return 'warn';
  return 'bad';
}

export function inpStatus(inp) {
  if (inp == null) return 'warn';
  if (inp <= 200) return 'good';
  if (inp <= 500) return 'warn';
  return 'bad';
}

export function clsStatus(cls) {
  if (cls == null) return 'warn';
  if (cls <= 0.1) return 'good';
  if (cls <= 0.25) return 'warn';
  return 'bad';
}

export function ttfbStatus(ttfb) {
  if (ttfb == null) return 'warn';
  if (ttfb <= 600) return 'good';
  if (ttfb <= 1000) return 'warn';
  return 'bad';
}

export function deriveQuickWins(unified) {
  const wins = [];
  const { kpi, breakdown, issues } = unified;

  const hasImageOpportunity = breakdown.images_kb && breakdown.images_kb > 300;
  const psiImageOpportunity = issues.psi_opportunities?.some((op) =>
    /images|image|صور|الصورة/i.test(op.title) || /images|image|صور|الصورة/i.test(op.desc)
  );
  if (hasImageOpportunity || psiImageOpportunity) {
    wins.push({
      title: 'تحسين الصور (WebP + Lazy Loading)',
      action: 'تحويل الصور الكبيرة إلى WebP وضبط أبعادها، مع تفعيل التحميل الكسول للصور خارج الشاشة.',
      impact: 'high',
    });
  }

  const hasJsDelay = issues.psi_opportunities?.some((op) =>
    /javascript|render-blocking|جافا/i.test(op.title)
  ) || (kpi.psi_mobile && kpi.psi_mobile < 70);
  if (hasJsDelay || (issues.psi_opportunities || []).some((op) => /reduce js/i.test(op.desc))) {
    wins.push({
      title: 'تأجيل وتحجيم ملفات JavaScript',
      action: 'تفعيل التحميل المؤجل للسكريبتات غير الحرجة وتقليل وقت تنفيذ JS عبر تقسيم الحزم.',
      impact: 'high',
    });
  }

  if ((kpi.requests && kpi.requests > 50) || (kpi.ttfb_ms && kpi.ttfb_ms > 800)) {
    wins.push({
      title: 'تحسين التخزين المؤقت وتوزيع المحتوى (CDN)',
      action: 'ضبط سياسة التخزين المؤقت للصفحات والوسائط، واستخدام CDN قريب من المستخدمين لخفض TTFB.',
      impact: 'med',
    });
  }

  if ((breakdown.fonts_kb && breakdown.fonts_kb > 200) || issues.psi_opportunities?.some((op) => /fonts|خطوط/i.test(op.title))) {
    wins.push({
      title: 'تهيئة الخطوط (Preload & Subset)',
      action: 'تقليل عدد أنماط الخطوط المستخدمة وتحضير ملفات WOFF2 بخطوط فرعية مسبقة التحميل.',
      impact: 'med',
    });
  }

  if (!wins.length) {
    wins.push({
      title: 'تنظيف العناصر غير الضرورية',
      action: 'مراجعة المكونات الخارجية، وإزالة الإضافات غير المستخدمة، وتخفيف واجهة البداية.',
      impact: 'med',
    });
  }

  return wins.slice(0, 5);
}

export function buildPlan() {
  return {
    phase1: [
      'مراجعة بيانات PageSpeed وGTmetrix وتحديد أولويات التنفيذ.',
      'إصلاح المشاكل الحرجة المؤثرة على LCP وINP.',
    ],
    phase2: [
      'تطبيق تحسينات الصور والملفات الثابتة (ضغط، CDN، Caching).',
      'تنفيذ تحديثات الكود (Defer JS، تنظيم CSS، تحسين الخطوط).',
    ],
    phase3: [
      'اختبارات قياس جديدة للتأكد من استقرار الأداء.',
      'إعداد مراقبة مستمرة والتنبيهات على Core Web Vitals.',
      'مراجعة التحسينات على الأجهزة الحقيقية وإقفال التチكتات.',
    ],
  };
}
