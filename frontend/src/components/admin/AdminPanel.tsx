import { useEffect, useState } from 'react';
import classNames from 'classnames';
import {
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck,
  Mail,
  Lock,
  ExternalLink,
  Store,
  ListChecks,
  FileText,
  Tag,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useStore } from '../../store';
import TextMenuImporter from './TextMenuImporter';
import MenuItemTable from './MenuItemTable';
import SpecialPricePanel from './SpecialPricePanel';
import LimitedItemPanel from './LimitedItemPanel';
import RestaurantManager from './RestaurantManager';
import OrderCleanupPanel from './OrderCleanupPanel';

type AdminTab =
  | 'restaurants'
  | 'items'
  | 'import'
  | 'special'
  | 'limited'
  | 'cleanup';

const ADMIN_TABS: { key: AdminTab; label: string; icon: typeof Store }[] = [
  { key: 'restaurants', label: '餐廳管理', icon: Store },
  { key: 'items', label: '品項管理', icon: ListChecks },
  { key: 'import', label: '文字匯入', icon: FileText },
  { key: 'special', label: '特價管理', icon: Tag },
  { key: 'limited', label: '限定商品', icon: Sparkles },
  { key: 'cleanup', label: '紀錄清理', icon: Trash2 },
];

export default function AdminPanel() {
  const [subTab, setSubTab] = useState<AdminTab>('restaurants');
  const [targetRestaurantId, setTargetRestaurantId] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const adminUser = useStore((s) => s.adminUser);
  const loadAdminData = useStore((s) => s.loadAdminData);
  const adminLoading = useStore((s) => s.adminLoading);
  const loginWithGoogle = useStore((s) => s.loginWithGoogle);
  const loginWithGoogleRedirect = useStore((s) => s.loginWithGoogleRedirect);
  const loginWithEmail = useStore((s) => s.loginWithEmail);
  const logoutAdmin = useStore((s) => s.logoutAdmin);

  useEffect(() => {
    if (adminUser) {
      loadAdminData();
    }
  }, [adminUser, loadAdminData]);

  const handleGoogleLogin = async () => {
    setAuthError('');
    setSubmittingAuth(true);
    const res = await loginWithGoogle();
    setSubmittingAuth(false);
    if (!res.ok) {
      setAuthError(res.error || 'Google 登入失敗');
    }
  };

  const handleGoogleRedirectLogin = async () => {
    setAuthError('');
    setRedirecting(true);
    try {
      await loginWithGoogleRedirect();
    } catch (err: any) {
      setRedirecting(false);
      setAuthError(err.message || '重新導向登入失敗');
    }
  };

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

  if (!adminUser) {
    return (
      <div
        className="admin-panel animate-fade-in flex flex-col items-center justify-center"
        style={{ minHeight: '60vh' }}
      >
        <div
          className="card"
          style={{
            maxWidth: 440,
            width: '100%',
            padding: '28px 24px',
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              style={{
                background: 'var(--primary-muted)',
                padding: 10,
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <ShieldCheck size={24} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="h2">管理員身分認證</h2>
              <p className="caption">請使用 Firebase 管理員帳號登入後台</p>
            </div>
          </div>

          {authError && (
            <div
              className="caption mb-4"
              style={{
                background: 'var(--error-muted)',
                color: 'var(--error)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {authError}
            </div>
          )}

          <button
            type="button"
            className="btn btn-outline w-full mb-2"
            onClick={handleGoogleLogin}
            disabled={submittingAuth || redirecting}
          >
            {submittingAuth ? (
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <LogIn size={16} strokeWidth={1.5} />
            )}
            使用 Google 帳號登入
          </button>

          <button
            type="button"
            className="btn btn-ghost w-full mb-4"
            onClick={handleGoogleRedirectLogin}
            disabled={submittingAuth || redirecting}
            style={{ fontSize: 13, border: '1px dashed var(--divider-strong)' }}
          >
            {redirecting ? (
              <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <ExternalLink size={14} strokeWidth={1.5} />
            )}
            改用網頁重新導向登入（免彈窗）
          </button>

          <div className="flex items-center gap-2 mb-4 label">
            <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
            <span>或使用 Email 登入</span>
            <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
          </div>

          <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
            <div
              className="flex items-center gap-2"
              style={{
                background: 'var(--surface)',
                padding: '0 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--divider-strong)',
              }}
            >
              <Mail size={16} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
              <input
                type="email"
                placeholder="管理員 Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
              />
            </div>
            <div
              className="flex items-center gap-2"
              style={{
                background: 'var(--surface)',
                padding: '0 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--divider-strong)',
              }}
            >
              <Lock size={16} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
              <input
                type="password"
                placeholder="密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full mt-2"
              disabled={submittingAuth}
            >
              {submittingAuth ? (
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              ) : (
                '登入後台'
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => useStore.getState().setOption('activeTab', 'order')}
            >
              返回訂餐介面
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel animate-fade-in">
      <div className="admin-header flex justify-between items-center flex-wrap gap-3 mb-4">
        <div>
          <div className="label">
            目前管理員：{adminUser.email || adminUser.displayName || '已登入'}
          </div>
          <h1 className="display-title">菜單與資料管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={logoutAdmin}
            title="登出管理員身分"
          >
            <LogOut size={14} strokeWidth={1.5} />
            登出
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => useStore.getState().setOption('activeTab', 'order')}
          >
            返回點餐
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="segmented-control mb-4">
        {ADMIN_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={classNames('segmented-item', { active: subTab === key })}
            onClick={() => setSubTab(key)}
          >
            <Icon size={16} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      {adminLoading && (
        <div className="flex justify-center items-center" style={{ padding: 40 }}>
          <Loader2
            size={28}
            strokeWidth={1.5}
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
          {subTab === 'items' && (
            <MenuItemTable
              initialRestaurantId={targetRestaurantId}
              key={targetRestaurantId}
            />
          )}
          {subTab === 'import' && (
            <TextMenuImporter
              initialRestaurantId={targetRestaurantId}
              key={targetRestaurantId}
            />
          )}
          {subTab === 'special' && <SpecialPricePanel />}
          {subTab === 'limited' && <LimitedItemPanel />}
          {subTab === 'cleanup' && <OrderCleanupPanel />}
        </div>
      )}
    </div>
  );
}
