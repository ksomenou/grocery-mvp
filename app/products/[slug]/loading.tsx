export default function ProductLoading() {
  return (
    <main className="shell section">
      <div className="product-detail">
        <div className="skeleton-detail-image" />
        <section className="panel product-detail-info">
          <div className="skeleton-line short" />
          <div className="skeleton-line wide" />
          <div className="skeleton-line" />
          <div className="skeleton-button" />
        </section>
      </div>
    </main>
  )
}
