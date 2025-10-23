import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const INITIAL_FORM = {
  psiUrl: '',
  clientName: '',
  preparedBy: 'فريق الأداء',
  language: 'ar',
  psiLink: '',
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [gtmetrixFile, setGtmetrixFile] = useState(null);
  const [beforeShot, setBeforeShot] = useState(null);
  const [afterShot, setAfterShot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setGtmetrixFile(file);
  };

  const handleShotChange = async (event, setter) => {
    const file = event.target.files?.[0];
    if (!file) {
      setter(null);
      return;
    }
    const base64 = await readFileAsDataUrl(file);
    setter(base64);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!gtmetrixFile) {
      setError('يرجى رفع ملف GTmetrix PDF.');
      return;
    }

    setLoading(true);
    try {
      const pdfBase64 = await readFileAsDataUrl(gtmetrixFile);

      const payload = {
        psiUrl: form.psiUrl.trim(),
        psiLink: form.psiLink.trim() || form.psiUrl.trim(),
        clientName: form.clientName.trim(),
        preparedBy: form.preparedBy.trim() || 'فريق الأداء',
        language: form.language,
        gtmetrixPdf: pdfBase64,
        beforeShot,
        afterShot,
      };

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'تعذر إكمال العملية.');
      }

      sessionStorage.setItem('reportData', JSON.stringify(result.report));
      sessionStorage.setItem('reportLanguage', result.language || 'ar');
      router.push('/preview');
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>مولد تقرير سرعة الموقع</title>
        <meta name="description" content="أداة لتوليد تقارير سرعة المواقع من PSI وGTmetrix" />
      </Head>
      <div className="container" dir="rtl">
        <div className="stepper">
          <div className="step active">1. إدخال البيانات</div>
          <div className="step">2. استخراج المؤشرات</div>
          <div className="step">3. المعاينة</div>
          <div className="step">4. تحميل PDF</div>
        </div>
        <div className="card">
          <h1 className="section-title">تجميع مدخلات التقرير</h1>
          <p className="notice">
            أدخل رابط PageSpeed Insights (موبايل) وارفع ملف GTmetrix بصيغة PDF، وسنقوم باستخراج أهم المؤشرات تلقائيًا.
          </p>
          <form onSubmit={handleSubmit} className="form-grid" noValidate>
            <div>
              <label htmlFor="psiUrl">رابط PageSpeed Insights</label>
              <input
                type="text"
                id="psiUrl"
                name="psiUrl"
                placeholder="https://pagespeed.web.dev/analysis/..."
                value={form.psiUrl}
                onChange={handleChange}
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="psiLink">رابط المعاينة (اختياري)</label>
              <input
                type="text"
                id="psiLink"
                name="psiLink"
                placeholder="ضع رابط مشاركة PSI إن توفر"
                value={form.psiLink}
                onChange={handleChange}
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="clientName">اسم العميل/الموقع (اختياري)</label>
              <input
                type="text"
                id="clientName"
                name="clientName"
                placeholder="شركة سريعة"
                value={form.clientName}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="preparedBy">مُعدّ التقرير</label>
              <input
                type="text"
                id="preparedBy"
                name="preparedBy"
                placeholder="فريق الأداء"
                value={form.preparedBy}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="language">لغة التقرير</label>
              <select id="language" name="language" value={form.language} onChange={handleChange}>
                <option value="ar">العربية (RTL)</option>
                <option value="en">English (LTR)</option>
              </select>
            </div>
            <div>
              <label htmlFor="gtmetrix">ملف GTmetrix PDF</label>
              <input id="gtmetrix" type="file" accept="application/pdf" onChange={handleFileChange} />
              <p className="hint">الملف إلزامي (يوفر مؤشرات الحجم والطلبات وTTFB).</p>
            </div>
            <div className="form-grid two-columns">
              <div>
                <label htmlFor="before">لقطة قبل (اختياري)</label>
                <input id="before" type="file" accept="image/*" onChange={(e) => handleShotChange(e, setBeforeShot)} />
              </div>
              <div>
                <label htmlFor="after">لقطة بعد (اختياري)</label>
                <input id="after" type="file" accept="image/*" onChange={(e) => handleShotChange(e, setAfterShot)} />
              </div>
            </div>

            {error && <div className="error">{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <span className="badge">PDF لايت مود · ألوان برتقالية</span>
              <button type="submit" className="primary" disabled={loading}>
                {loading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                    <span className="loader" /> جاري استخراج البيانات
                  </span>
                ) : (
                  'توليد التقرير'
                )}
              </button>
            </div>
          </form>
        </div>
        <p className="footer">الخطوات التالية: سيُعاد توجيهك للمعاينة بعد استخراج المؤشرات من PSI وGTmetrix.</p>
      </div>
    </>
  );
}
