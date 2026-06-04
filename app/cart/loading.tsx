export default function CartLoading() {
  return (
    <main className="shell cart-page">
      <div className="page-title">
        <div className="skeleton-line short" />
        <div className="skeleton-line" />
      </div>
      <div className="two-col">
        <section className="panel cart-loading">
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </section>
        <aside className="panel">
          <div className="skeleton-line wide" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </aside>
      </div>
    </main>
  )
}
