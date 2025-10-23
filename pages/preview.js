import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  psiStatus,
  lcpStatus,
  inpStatus,
  clsStatus,
  ttfbStatus,
} from '@/lib/quickWins';

function statusClass(status) {
  if (status === 'good') return 'chip good';
  if (status === 'bad') return 'chip bad';
  return 'chip warn';
}

export default function Preview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem('reportData');
    if (!stored) {
      setError('لا يوجد تقرير للعرض. يرجى العودة للصفحة الرئيسية.');
      setLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setData(parsed);
    } catch (err) {
      console.error(err);
      setError('تعذر قراءة التقرير المخزن.');
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadPdf = async () => {
    if (!data) return;
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'فشل توليد PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'speed-audit.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <>
      <Head>
        <title>معاينة التقرير</title>
      </Head>
      <div className="container" dir="rtl">
        <div className="stepper">
          <div className="step">1. إدخال البيانات</div>
          <div className="step active">2. استخراج المؤشرات</div>
          <div className="step active">3. المعاينة</div>
          <div className="step">4. تحميل PDF</div>
        </div>
        <div className="preview-actions">
          <button className="secondary" onClick={() => router.push('/')}>⟵ العودة للتعديل</button>
          <button className="primary" onClick={downloadPdf} disabled={!data}>تنزيل PDF النهائي</button>
        </div>

        {loading && <p>جارٍ تجهيز المعاينة...</p>}
        {error && <p className="error">{error}</p>}

        {data && (
          <div className="preview-wrapper">
            <div className="card">
              <h2 className="section-title">الملخص التنفيذي</h2>
              <div className="metrics-grid">
                <div className="metric-card">
                  <h3>PSI — موبايل</h3>
                  <div className="metric-value">{data.kpi.psi_mobile ?? '--'}</div>
                  <span className={statusClass(psiStatus(data.kpi.psi_mobile))}>الحالة</span>
                  <div className="metric-target">الهدف ≥ 75</div>
                </div>
                <div className="metric-card">
                  <h3>PSI — كمبيوتر</h3>
                  <div className="metric-value">{data.kpi.psi_desktop ?? '--'}</div>
                  <span className={statusClass(psiStatus(data.kpi.psi_desktop))}>الحالة</span>
                  <div className="metric-target">الهدف ≥ 80</div>
                </div>
                <div className="metric-card">
                  <h3>LCP (ث)</h3>
                  <div className="metric-value">{data.kpi.lcp_s ?? '--'}</div>
                  <span className={statusClass(lcpStatus(data.kpi.lcp_s))}>الحالة</span>
                  <div className="metric-target">≤ 2.5 ث</div>
                </div>
                <div className="metric-card">
                  <h3>INP (ملّي)</h3>
                  <div className="metric-value">{data.kpi.inp_ms ?? '--'}</div>
                  <span className={statusClass(inpStatus(data.kpi.inp_ms))}>الحالة</span>
                  <div className="metric-target">≤ 200 ملّي</div>
                </div>
                <div className="metric-card">
                  <h3>CLS</h3>
                  <div className="metric-value">{data.kpi.cls ?? '--'}</div>
                  <span className={statusClass(clsStatus(data.kpi.cls))}>الحالة</span>
                  <div className="metric-target">≤ 0.10</div>
                </div>
                <div className="metric-card">
                  <h3>TTFB (ملّي)</h3>
                  <div className="metric-value">{data.kpi.ttfb_ms ?? '--'}</div>
                  <span className={statusClass(ttfbStatus(data.kpi.ttfb_ms))}>الحالة</span>
                  <div className="metric-target">≤ 600 ملّي</div>
                </div>
              </div>
              <div style={{ marginTop: '24px' }}>
                <div className="bar">
                  <span style={{ width: `${Math.min(Number(data.kpi.psi_mobile || 0), 100)}%` }} />
                </div>
                <p className="hint" style={{ marginTop: '8px' }}>يُظهر الشريط قوة التجربة على الموبايل، المستهدف ≥ 75.</p>
              </div>
            </div>

            <div className="card">
              <h2 className="section-title">أكبر المشاكل</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>المصدر</th>
                    <th>المشكلة</th>
                    <th>الأثر</th>
                    <th>الجهد</th>
                    <th>الحل المقترح</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_issues?.map((issue, index) => (
                    <tr key={`${issue.title}-${index}`}>
                      <td>{issue.source}</td>
                      <td>{issue.title}</td>
                      <td>{issue.impact}</td>
                      <td>{issue.effort}</td>
                      <td>{issue.fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2 className="section-title">Quick Wins (0–7 أيام)</h2>
              <div className="quick-wins-list">
                {data.quick_wins?.map((item, index) => (
                  <div className="quick-win" key={`${item.title}-${index}`}>
                    <strong>{item.title}:</strong> {item.action}
                    <div className="hint">أثر متوقع: {item.impact}</div>
                  </div>
                ))}
              </div>
              <p className="hint" style={{ marginTop: '12px' }}>تقدير المكسب المتوقع: +{data.est_gain} نقاط على الموبايل.</p>
            </div>

            <div className="card">
              <h2 className="section-title">خطة التنفيذ المرحلية</h2>
              <div className="plan-grid">
                <div className="plan-card">
                  <h3>مرحلة 1 (48 ساعة)</h3>
                  <ul>
                    {data.plan.phase1?.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="plan-card">
                  <h3>مرحلة 2 (أسبوع)</h3>
                  <ul>
                    {data.plan.phase2?.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="plan-card">
                  <h3>مرحلة 3 (2–3 أسابيع)</h3>
                  <ul>
                    {data.plan.phase3?.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="section-title">لقطات قبل/بعد</h2>
              <div className="shots-grid">
                <div className="shot">
                  {data.shots?.before ? (
                    <img src={data.shots.before} alt="قبل" />
                  ) : (
                    <span className="hint">يمكن إضافة لقطة قبل لاحقًا</span>
                  )}
                </div>
                <div className="shot">
                  {data.shots?.after ? (
                    <img src={data.shots.after} alt="بعد" />
                  ) : (
                    <span className="hint">يمكن إضافة لقطة بعد لاحقًا</span>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="section-title">المراجع</h2>
              <ul className="hint">
                <li>PSI: {data.meta.psi_link || '—'}</li>
                <li>GTmetrix: {data.meta.gtmetrix_filename || '—'}</li>
                <li>تاريخ القياس: PSI {data.meta.date_psi} · GTmetrix {data.meta.date_gtm}</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
