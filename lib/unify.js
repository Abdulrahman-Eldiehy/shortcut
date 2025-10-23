import { deriveQuickWins, buildPlan } from './quickWins';

function normalizeNumber(value, multiplier = 1) {
  if (value == null) return null;
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return null;
  return Number((num * multiplier).toFixed(2));
}

function mergeIssues(psiOpportunities, gtmFindings) {
  const list = [];
  psiOpportunities.forEach((item) => {
    list.push({
      source: 'PSI',
      title: item.title,
      impact: item.savings?.value ? `${item.savings.value.toFixed(1)} ${item.savings.type === 'time_s' ? 'ثانية' : 'KB'}` : 'مرتفع',
      effort: 'متوسط',
      fix: item.desc,
    });
  });
  gtmFindings.forEach((item) => {
    list.push({
      source: 'GTmetrix',
      title: item.title,
      impact: item.impact === 'high' ? 'مرتفع' : item.impact === 'med' ? 'متوسط' : 'منخفض',
      effort: item.impact === 'high' ? 'عالي' : 'متوسط',
      fix: item.detail,
    });
  });
  return list.slice(0, 8);
}

export function buildUnifiedReport({
  psi,
  gtmetrix,
  meta,
  manual = {},
}) {
  const psiMobile = psi.mobile;
  const psiDesktop = psi.desktop;

  const kpi = {
    psi_mobile: psiMobile?.score ?? manual.psi_mobile ?? null,
    psi_desktop: psiDesktop?.score ?? manual.psi_desktop ?? null,
    lcp_s: normalizeNumber(psiMobile?.lcp ?? gtmetrix.metrics?.lcp_s ?? manual.lcp_s),
    inp_ms: normalizeNumber(psiMobile?.inp ?? manual.inp_ms),
    cls: normalizeNumber(psiMobile?.cls ?? gtmetrix.metrics?.cls ?? manual.cls),
    ttfb_ms: normalizeNumber((psiMobile?.ttfb ?? (gtmetrix.metrics?.ttfb_s ? gtmetrix.metrics.ttfb_s * 1000 : null)), 1),
    page_size_mb: normalizeNumber(gtmetrix.metrics?.page_size_mb ?? manual.page_size_mb),
    requests: gtmetrix.metrics?.requests ?? manual.requests ?? null,
  };

  const breakdown = {
    fonts_kb: normalizeNumber(gtmetrix.breakdown?.fonts_kb),
    images_kb: normalizeNumber(gtmetrix.breakdown?.images_kb),
    css_kb: normalizeNumber(gtmetrix.breakdown?.css_kb),
    js_kb: normalizeNumber(gtmetrix.breakdown?.js_kb),
  };

  const psiOpportunities = (psiMobile?.opportunities || []).map((op) => ({
    title: op.title,
    desc: op.desc,
    savings: op.savings,
  }));

  const issues = {
    psi_opportunities: psiOpportunities,
    gtm_findings: gtmetrix.findings || [],
    chains: {
      count: gtmetrix.metrics?.chains ?? 0,
    },
  };

  const quickWins = deriveQuickWins({ kpi, breakdown, issues });
  const plan = buildPlan();

  const topIssues = mergeIssues(psiOpportunities, gtmetrix.findings || []);

  return {
    meta: {
      site_url: meta.siteUrl,
      client_name: meta.clientName,
      date_psi: meta.datePsi,
      date_gtm: meta.dateGtm,
      psi_link: meta.psiLink,
      gtmetrix_filename: meta.gtmetrixFilename,
      prepared_by: meta.preparedBy || 'فريق الأداء',
    },
    kpi,
    breakdown,
    issues,
    quick_wins: quickWins,
    plan,
    shots: meta.shots || { before: null, after: null },
    top_issues: topIssues,
    est_gain: quickWins.length ? 8 + quickWins.length * 2 : 6,
  };
}
