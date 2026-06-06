"use client"

export function AdminLogoutForm({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={() => {
        window.dispatchEvent(new Event("freshcart-admin-logout"))
      }}
    >
      <button className="button secondary" type="submit">Log out</button>
    </form>
  )
}
