import pdf from 'pdf-parse';

function parseNumber(match) {
  if (!match) return null;
  const value = match[1].replace(/,/g, '.');
  return Number(value);
}

function parseInteger(match) {
  if (!match) return null;
  return Number(match[1].replace(/[^0-9]/g, ''));
}

export async function parseGtmetrixPdf(base64Data) {
  if (!base64Data) {
    return { text: '', metrics: {}, breakdown: {}, findings: [] };
  }
  const buffer = Buffer.from(base64Data, 'base64');
  const data = await pdf(buffer);
  const text = data.text || '';

  const metrics = {
    performance: parseNumber(text.match(/Performance\s+(\d+)%/i)),
    structure: parseNumber(text.match(/Structure\s+(\d+)%/i)),
    lcp_s: parseNumber(text.match(/Largest Contentful Paint\s+(\d+[.,]?\d*)s/i)),
    tbt_ms: parseInteger(text.match(/Total Blocking Time\s+(\d+)ms/i)),
    cls: parseNumber(text.match(/Cumulative Layout Shift\s+(\d+[.,]?\d*)/i)),
    ttfb_s: parseNumber(text.match(/Time to First Byte\s+(\d+[.,]?\d*)s/i)),
    page_size_mb: parseNumber(text.match(/Total Page Size\s+(\d+[.,]?\d*)MB/i)),
    requests: parseInteger(text.match(/Requests\s+(\d+)/i)),
    chains: parseInteger(text.match(/chains?\s+(\d+)/i)),
  };

  const breakdown = {
    fonts_kb: parseNumber(text.match(/Fonts\s+(\d+[.,]?\d*)\s?KB/i)),
    images_kb: parseNumber(text.match(/Images\s+(\d+[.,]?\d*)\s?KB/i)),
    css_kb: parseNumber(text.match(/CSS\s+(\d+[.,]?\d*)\s?KB/i)),
    js_kb: parseNumber(text.match(/JS\s+(\d+[.,]?\d*)\s?KB/i)),
  };

  const findings = [];
  const issueRegex = /(High|Medium|Low)\s+impact\s+-\s+([^\n]+)\n([^\n]+)/gi;
  let match;
  while ((match = issueRegex.exec(text)) !== null) {
    findings.push({
      title: match[2].trim(),
      detail: match[3].trim(),
      impact: match[1].toLowerCase().startsWith('h') ? 'high' : match[1].toLowerCase().startsWith('m') ? 'med' : 'low',
    });
  }

  return { text, metrics, breakdown, findings };
}
