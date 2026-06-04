export default function AdminLoading() {
  return (
    <main className="shell admin-dashboard-page">
      <div className="page-title admin-dashboard-title">
        <div>
          <div className="skeleton-line short" />
          <div className="skeleton-line wide" />
          <div className="skeleton-line" />
        </div>
      </div>
      <section className="admin-metrics dense dashboard-skeleton-metrics">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="metric-card dashboard-skeleton-card" key={index}>
            <div className="skeleton-line short" />
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        ))}
      </section>
      <div className="admin-ops-grid dense dashboard-skeleton-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <section className="ops-panel dashboard-skeleton-panel" key={index}>
            <div className="skeleton-line short" />
            <div className="skeleton-line" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </section>
        ))}
      </div>
    </main>
  )
}
