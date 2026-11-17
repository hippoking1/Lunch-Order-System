import { useState, useMemo } from 'react';
import { Calendar, Search, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import { getTodayDateString, type OrdersRangePreview } from '../../services/firestoreApi';
import Modal from '../common/Modal';

function formatOffsetDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function getLastMonthRange(): { start: string; end: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 86400000);
  const firstOfPrevMonth = new Date(
    lastOfPrevMonth.getFullYear(),
    lastOfPrevMonth.getMonth(),
    1,
  );
  const fmt = (dt: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dt);
  return { start: fmt(firstOfPrevMonth), end: fmt(lastOfPrevMonth) };
}

export default function OrderCleanupPanel() {
  const adminPreviewOrdersInRange = useStore((s) => s.adminPreviewOrdersInRange);
  const adminDeleteOrdersInRange = useStore((s) => s.adminDeleteOrdersInRange);
  const addToast = useToast((s) => s.addToast);

  const today = useMemo(() => getTodayDateString(), []);
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(() => formatOffsetDate(30));
  const [includeDailyMeta, setIncludeDailyMeta] = useState(true);

  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<OrdersRangePreview | null>(null);
  const [previewRange, setPreviewRange] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const applyPreset = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setPreview(null);
    setPreviewRange(null);
  };

  const handlePreview = async () => {
    if (!startDate || !endDate) {
      addToast('error', '請選擇起始與結束日期');
      return;
    }
    if (startDate > endDate) {
      addToast('error', '起始日期不可晚於結束日期');
      return;
    }
    setScanning(true);
    const res = await adminPreviewOrdersInRange(startDate, endDate);
    setScanning(false);
    if (res.ok && res.preview) {
      setPreview(res.preview);
      setPreviewRange({ start: startDate, end: endDate });
      if (
        res.preview.ordersCount === 0 &&
        res.preview.confirmationsCount === 0 &&
        res.preview.locksCount === 0
      ) {
        addToast('info', '此日期區間內無任何點餐紀錄');
      }
    } else {
      addToast('error', res.error || '查詢失敗');
    }
  };

  const handleConfirmDelete = async () => {
    if (!previewRange) return;
    setConfirmOpen(false);
    setDeleting(true);
    const res = await adminDeleteOrdersInRange(
      previewRange.start,
      previewRange.end,
      includeDailyMeta,
    );
    setDeleting(false);
    if (res.ok) {
      addToast(
        'success',
        `已刪除 ${res.deletedOrders || 0} 筆點餐紀錄` +
          (includeDailyMeta
            ? `（含 ${res.deletedConfirmations || 0} 筆確認與 ${res.deletedLocks || 0} 筆鎖定）`
            : ''),
      );
      setPreview(null);
      setPreviewRange(null);
    } else {
      addToast('error', res.error || '刪除失敗');
    }
  };

  const rangeChangedSincePreview =
    previewRange !== null &&
    (previewRange.start !== startDate || previewRange.end !== endDate);
  const includesToday = !!startDate && !!endDate && today >= startDate && today <= endDate;
  const totalDocsToDelete = preview
    ? preview.ordersCount +
      (includeDailyMeta ? preview.confirmationsCount + preview.locksCount : 0)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="h3 mb-3">
          <Calendar size={16} strokeWidth={1.5} />
          歷史點餐紀錄清理
        </div>
        <p className="caption mb-4" style={{ lineHeight: 1.6 }}>
          指定日期區間以批次刪除過期點餐紀錄，避免資料庫持續肥大。此動作僅清理紀錄本身，
          <strong style={{ color: 'var(--text-primary)' }}>不會退還</strong>
          員工帳戶已扣款之餘額。
        </p>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="label">快速區間：</span>
          <button
            type="button"
            className="chip-btn"
            onClick={() => applyPreset('2020-01-01', formatOffsetDate(30))}
          >
            30 天前以前
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => applyPreset('2020-01-01', formatOffsetDate(90))}
          >
            90 天前以前
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => {
              const m = getLastMonthRange();
              applyPreset(m.start, m.end);
            }}
          >
            上個月整月
          </button>
        </div>

        {/* Date Inputs */}
        <div className="flex gap-3 items-end flex-wrap mb-4">
          <div style={{ minWidth: 160 }}>
            <label className="label mb-1" style={{ display: 'block' }}>
              起始日期
            </label>
            <input
              type="date"
              className="mono"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPreview(null);
              }}
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <label className="label mb-1" style={{ display: 'block' }}>
              結束日期
            </label>
            <input
              type="date"
              className="mono"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPreview(null);
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handlePreview}
            disabled={scanning || deleting}
          >
            {scanning ? (
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <Search size={16} strokeWidth={1.5} />
            )}
            查詢區間筆數
          </button>
        </div>

        <label className="flex items-center gap-2 cursor-pointer caption">
          <input
            type="checkbox"
            className="checkbox-styled"
            checked={includeDailyMeta}
            onChange={(e) => setIncludeDailyMeta(e.target.checked)}
          />
          同步清理該區間的每日餐廳鎖定 (categoryLocks) 與下單確認紀錄 (confirmations)
        </label>

        {includesToday && (
          <div
            className="mt-3 flex items-center gap-2 caption"
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--warning-muted)',
              color: 'var(--warning)',
            }}
          >
            <AlertTriangle size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            注意：目前選擇的區間包含今日（{today}），請確認是否真的要刪除今日訂單。
          </div>
        )}
      </div>

      {/* Preview Result */}
      {preview && !rangeChangedSincePreview && (
        <div className="card animate-slide-up">
          <div className="flex justify-between items-center flex-wrap gap-2 mb-3">
            <div className="h3">查詢結果預覽</div>
            <span className="mono label">
              {previewRange?.start} ~ {previewRange?.end}
            </span>
          </div>

          <div className="recon-strip mb-4">
            <div className="recon-stat">
              <span className="recon-stat-label">點餐紀錄 (orders)</span>
              <span className="recon-stat-val">{preview.ordersCount} 筆</span>
            </div>
            <div className="recon-stat">
              <span className="recon-stat-label">紀錄累計金額</span>
              <span className="recon-stat-val">${preview.totalAmount}</span>
            </div>
            <div className="recon-stat">
              <span className="recon-stat-label">鎖定 / 確認文件</span>
              <span className="recon-stat-val">
                {preview.locksCount + preview.confirmationsCount} 筆
              </span>
            </div>
          </div>

          {preview.earliestDate && (
            <div className="label mono mb-4">
              實際資料日期範圍：{preview.earliestDate} ~ {preview.latestDate}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-danger"
              disabled={totalDocsToDelete === 0 || deleting}
              onClick={() => setConfirmOpen(true)}
            >
              {deleting ? (
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <Trash2 size={16} strokeWidth={1.5} />
              )}
              永久刪除 {totalDocsToDelete} 筆文件
            </button>
          </div>
        </div>
      )}

      {confirmOpen && preview && previewRange && (
        <Modal
          title="確認永久刪除歷史紀錄"
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirmDelete}
          confirmLabel="確認刪除"
          variant="danger"
        >
          確定要永久刪除 <strong>{previewRange.start}</strong> 至{' '}
          <strong>{previewRange.end}</strong> 共{' '}
          <strong>{preview.ordersCount}</strong> 筆點餐紀錄
          {includeDailyMeta
            ? `（以及 ${preview.confirmationsCount} 筆確認、${preview.locksCount} 筆鎖定）`
            : ''}
          嗎？刪除後無法復原，且不會退還員工已扣款之帳戶餘額。
        </Modal>
      )}
    </div>
  );
}
