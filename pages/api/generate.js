import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

let templateCache = null;

async function loadTemplate() {
  if (templateCache) return templateCache;
  const templatePath = path.join(process.cwd(), 'templates', 'report.hbs');
  const templateContent = await fs.readFile(templatePath, 'utf8');
  templateCache = Handlebars.compile(templateContent);
  return templateCache;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'الطريقة غير مدعومة' });
  }

  try {
    const template = await loadTemplate();
    const data = req.body;
    const html = template(data);

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
    });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="speed-audit.pdf"');
    res.send(pdf);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'تعذّر توليد ملف PDF.' });
  }
}
