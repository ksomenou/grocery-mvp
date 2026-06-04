export default function Loading() {
  return (
    <main className="shell section">
      <div className="skeleton-hero" />
      <section className="section">
        <div className="skeleton-line wide" />
        <div className="skeleton-shelf">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="skeleton-card" key={index} />
          ))}
        </div>
      </section>
    </main>
  )
}
