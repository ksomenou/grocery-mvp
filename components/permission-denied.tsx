export function PermissionDenied({
  message = "You do not have permission to access this page."
}: {
  message?: string
}) {
  return (
    <main className="shell">
      <section className="panel" style={{ marginTop: 30 }}>
        <p className="badge">Access restricted</p>
        <h1>{message}</h1>
        <p className="muted">Please contact the store owner if you need additional access.</p>
      </section>
    </main>
  )
}
