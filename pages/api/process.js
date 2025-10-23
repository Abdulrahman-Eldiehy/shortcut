import { buildUnifiedReport } from '@/lib/unify';
import { getPsiInsights } from '@/lib/psi';
import { parseGtmetrixPdf } from '@/lib/gtmetrix';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

function inferDate(label) {
  if (!label) return '';
  const match = label.match(/(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'الطريقة غير مدعومة' });
  }

  try {
    const {
      psiUrl,
      gtmetrixPdf,
      clientName,
      preparedBy,
      language = 'ar',
      manualFallback = {},
      beforeShot,
      afterShot,
      psiLink,
    } = req.body;

    if (!gtmetrixPdf) {
      return res.status(400).json({ error: 'ملف GTmetrix PDF مطلوب.' });
    }

    const psiInsights = psiUrl ? await getPsiInsights(psiUrl) : { mobile: {}, desktop: {} };
    const parsedPdf = await parseGtmetrixPdf(gtmetrixPdf.replace(/^data:application\/pdf;base64,/, ''));

    const report = buildUnifiedReport({
      psi: psiInsights,
      gtmetrix: parsedPdf,
      manual: manualFallback,
      meta: {
        siteUrl: psiUrl,
        clientName: clientName || '—',
        datePsi: psiInsights?.fetchedAt ? psiInsights.fetchedAt.slice(0, 10) : inferDate(),
        dateGtm: inferDate(parsedPdf?.info?.CreationDate) || new Date().toISOString().slice(0, 10),
        psiLink: psiLink || psiUrl,
        gtmetrixFilename: `gtmetrix-report.pdf`,
        preparedBy: preparedBy || 'فريق الأداء',
        shots: {
          before: beforeShot || null,
          after: afterShot || null,
        },
      },
    });

    res.status(200).json({
      report,
      language,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'حدث خطأ غير متوقع.' });
  }
}
