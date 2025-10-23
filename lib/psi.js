const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

async function runPagespeed(url, strategy = 'mobile') {
  const params = new URLSearchParams({
    url,
    strategy,
    category: 'performance',
  });
  const apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey) {
    params.set('key', apiKey);
  }

  const response = await fetch(`${PSI_ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`فشل جلب بيانات PSI (${strategy})`);
  }
  return response.json();
}

function extractNumeric(metric) {
  if (typeof metric === 'number') return metric;
  if (!metric) return null;
  if (typeof metric === 'string') {
    const cleaned = metric.replace(/[^0-9.]/g, '');
    return cleaned ? Number(cleaned) : null;
  }
  return null;
}

function getMetricFromDetails(details, key) {
  if (!details || !Array.isArray(details.items) || !details.items.length) {
    return null;
  }
  const item = details.items[0];
  return extractNumeric(item[key]);
}

function parseOpportunities(audits) {
  return Object.values(audits || {})
    .filter((audit) => audit.details && audit.details.type === 'opportunity')
    .map((audit) => ({
      id: audit.id,
      title: audit.title,
      description: audit.description,
      score: audit.score,
      displayValue: audit.displayValue,
      numericValue: audit.numericValue ?? 0,
    }))
    .sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0))
    .slice(0, 5)
    .map((item) => {
      const match = item.displayValue ? item.displayValue.match(/([0-9.,]+)\s*(s|ث|ms|KB|kB|B|MB)/i) : null;
      let type = 'time_s';
      let value = null;
      if (match) {
        const [, num, unit] = match;
        const numeric = Number(num.replace(',', '.'));
        if (/ms/i.test(unit)) {
          type = 'time_s';
          value = numeric / 1000;
        } else if (/s/i.test(unit)) {
          type = 'time_s';
          value = numeric;
        } else {
          type = 'kb';
          value = /m/i.test(unit) ? numeric * 1024 : numeric;
        }
      }
      return {
        title: item.title,
        desc: item.description || item.displayValue || '',
        savings: {
          type,
          value,
        },
        source: 'PSI',
        impact: item.numericValue,
      };
    });
}

function parseMetrics(result) {
  const { lighthouseResult } = result || {};
  if (!lighthouseResult) {
    return {};
  }
  const { audits } = lighthouseResult;
  const metrics = audits?.metrics?.details?.items?.[0] || {};

  const inpAudit = audits?.['interaction-to-next-paint'];
  const inpMs = getMetricFromDetails(inpAudit?.details, 'percentile') || inpAudit?.numericValue;

  return {
    score: lighthouseResult?.categories?.performance?.score != null
      ? Math.round((lighthouseResult.categories.performance.score || 0) * 100)
      : null,
    lcp: extractNumeric(metrics.observedLargestContentfulPaint) / 1000 ||
      extractNumeric(audits?.['largest-contentful-paint']?.numericValue) / 1000 ||
      null,
    fcp: extractNumeric(metrics.observedFirstContentfulPaint) / 1000 || null,
    inp: inpMs ? inpMs : null,
    cls: audits?.['cumulative-layout-shift']?.numericValue ?? metrics.cumulativeLayoutShift ?? null,
    tbt: audits?.['total-blocking-time']?.numericValue ?? null,
    ttfb: audits?.['server-response-time']?.numericValue ?? audits?.['experimental-time-to-first-byte']?.numericValue ?? null,
    opportunities: parseOpportunities(audits),
  };
}

export async function getPsiInsights(url) {
  const [mobile, desktop] = await Promise.all([
    runPagespeed(url, 'mobile'),
    runPagespeed(url, 'desktop'),
  ]);
  return {
    mobile: parseMetrics(mobile),
    desktop: parseMetrics(desktop),
    fetchedAt: new Date().toISOString(),
    rawMobile: mobile,
    rawDesktop: desktop,
  };
}
