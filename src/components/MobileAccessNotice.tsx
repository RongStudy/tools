const MobileAccessNotice = ({ tablet }: { tablet: boolean }) => (
  <main className="mobile-access-notice" aria-labelledby="mobile-access-title">
    <div className="mobile-access-content">
      <svg className="mobile-access-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="7" width="38" height="27" rx="3" />
        <path d="M18 42h12M24 34v8" />
      </svg>
      <p className="mobile-access-brand">Forge 工具箱</p>
      <h1 id="mobile-access-title">请使用 PC 访问</h1>
      <p className="mobile-access-description">{tablet ? '当前屏幕宽度不足，请尝试横屏或使用电脑打开。' : '暂不支持手机使用，请在电脑浏览器中打开。'}</p>
    </div>
  </main>
)

export default MobileAccessNotice
