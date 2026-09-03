import { useEffect, useState } from 'react';
import classNames from 'classnames';
import { Loader2, LogIn, LogOut, ShieldCheck, Mail, Lock } from 'lucide-react';
import { useStore } from '../../store';
import TextMenuImporter from './TextMenuImporter';
import MenuItemTable from './MenuItemTable';
import SpecialPricePanel from './SpecialPricePanel';
import LimitedItemPanel from './LimitedItemPanel';
import RestaurantManager from './RestaurantManager';

type AdminTab = 'restaurants' | 'items' | 'import' | 'special' | 'limited';

const ADMIN_TABS: { key: AdminTab; label: string; emoji: string }[] = [
  { key: 'restaurants', label: '餐廳管理', emoji: '🏪' },
  { key: 'items', label: '品項管理', emoji: '📊' },
  { key: 'import', label: '文字匯入', emoji: '📝' },
  { key: 'special', label: '特價管理', emoji: '💰' },
  { key: 'limited', label: '限定商品', emoji: '🌸' },
];

export default function AdminPanel() {
  const [subTab, setSubTab] = useState<AdminTab>('restaurants');
  const [targetRestaurantId, setTargetRestaurantId] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);

  const adminUser = useStore((s) => s.adminUser);
  const loadAdminData = useStore((s) => s.loadAdminData);
  const adminLoading = useStore((s) => s.adminLoading);
  const loginWithGoogle = useStore((s) => s.loginWithGoogle);
  const loginWithEmail = useStore((s) => s.loginWithEmail);
  const logoutAdmin = useStore((s) => s.logoutAdmin);

  useEffect(() => {
    if (adminUser) {
      loadAdminData();
    }
  }, [adminUser, loadAdminData]);

  // 處理 Google 登入
  const handleGoogleLogin = async () => {
    setAuthError('');
    setSubmittingAuth(true);
    const res = await loginWithGoogle();
    setSubmittingAuth(false);
    if (!res.ok) {
      setAuthError(res.error || 'Google 登入失敗');
    }
  };

  // 處理 Email 登入
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError('請填寫完整 Email 與密碼');
      return;
    }
    setAuthError('');
    setSubmittingAuth(true);
    const res = await loginWithEmail(email, password);
    setSubmittingAuth(false);
    if (!res.ok) {
      setAuthError(res.error || '登入失敗，請確認帳號密碼');
    }
  };

  // 未登入 Firebase Auth 時顯示驗證介面
  if (!adminUser) {
    return (
      <div className="admin-panel animate-fade-in flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: 440, width: '100%', padding: '32px 28px', border: '1px solid var(--glass-border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div style={{ background: 'var(--primary-light, rgba(245, 166, 35, 0.15))', padding: 10, borderRadius: 12 }}>
              <ShieldCheck size={28} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>管理員身分認證</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>請使用 Firebase 管理員帳號登入後台</p>
            </div>
          </div>

          {authError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              {authError}
            </div>
          )}

          {/* Google 登入 */}
          <button
            type="button"
            className="btn btn-outline w-full flex items-center justify-center gap-2 mb-4"
            onClick={handleGoogleLogin}
            disabled={submittingAuth}
            style={{ padding: '12px 16px', fontWeight: 600 }}
          >
            {submittingAuth ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            使用 Google 帳號一鍵登入
          </button>

          <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
            <span>或使用 Email 登入</span>
            <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
          </div>

          {/* Email 密碼登入 */}
          <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
            <div className="flex items-center gap-2" style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
              <Mail size={16} style={{ color: 'var(--text-secondary)' }} />
              <input
                type="email"
                placeholder="管理員 Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'inherit', width: '100%', outline: 'none', fontSize: 14 }}
              />
            </div>
            <div className="flex items-center gap-2" style={{ background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
              <Lock size={16} style={{ color: 'var(--text-secondary)' }} />
              <input
                type="password"
                placeholder="密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'inherit', width: '100%', outline: 'none', fontSize: 14 }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full mt-2 flex items-center justify-center gap-2"
              disabled={submittingAuth}
              style={{ padding: '10px 16px' }}
            >
              {submittingAuth ? <Loader2 size={16} className="animate-spin" /> : '登入後台'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="btn btn-sm"
              style={{ color: 'var(--text-secondary)', background: 'transparent', fontSize: 13 }}
              onClick={() => useStore.getState().setOption('activeTab', 'order')}
            >
              ← 返回一般點餐介面
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel animate-fade-in">
      <div className="admin-header flex justify-between items-center mb-4">
        <div>
          <div className="app-brand">Menu Management</div>
          <h1
            className="display-title"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
          >
            菜單管理.
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            目前管理員：{adminUser.email || adminUser.displayName || '已登入'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-outline btn-sm flex items-center gap-1"
            onClick={logoutAdmin}
            title="登出管理員身分"
          >
            <LogOut size={14} /> 登出
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => useStore.getState().setOption('activeTab', 'order')}
          >
            返回點餐
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="segmented-control mb-4">
        {ADMIN_TABS.map(({ key, label, emoji }) => (
          <button
            key={key}
            className={classNames('segmented-item', { active: subTab === key })}
            onClick={() => setSubTab(key)}
          >
            {emoji} {label}
          </button>
        ))}
      </div>

      {adminLoading && (
        <div
          className="flex justify-center items-center"
          style={{ padding: 40 }}
        >
          <Loader2
            size={32}
            className="animate-spin"
            style={{ color: 'var(--primary)' }}
          />
        </div>
      )}

      {!adminLoading && (
        <div className="admin-content animate-slide-up">
          {subTab === 'restaurants' && (
            <RestaurantManager
              onNavigateToImport={(restId) => {
                setTargetRestaurantId(restId);
                setSubTab('import');
              }}
              onNavigateToItems={(restId) => {
                setTargetRestaurantId(restId);
                setSubTab('items');
              }}
            />
          )}
          {subTab === 'items' && <MenuItemTable initialRestaurantId={targetRestaurantId} key={targetRestaurantId} />}
          {subTab === 'import' && <TextMenuImporter initialRestaurantId={targetRestaurantId} key={targetRestaurantId} />}
          {subTab === 'special' && <SpecialPricePanel />}
          {subTab === 'limited' && <LimitedItemPanel />}
        </div>
      )}
    </div>
  );
}
