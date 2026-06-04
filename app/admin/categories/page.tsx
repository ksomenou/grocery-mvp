import { AdminNav } from "@/components/admin-nav"
import { AdminActionForm, AdminDeleteForm, EmptyState, ImagePreviewInput, SubmitButton } from "@/components/admin-ui"
import { createCategory, deleteCategory, updateCategory } from "@/lib/actions"
import { prisma } from "@/lib/prisma"
import Image from "next/image"

export const dynamic = "force-dynamic"

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" }
  })

  return (
    <main className="shell">
      <div className="page-title">
        <p className="admin-kicker">Store admin</p>
        <h1>Categories</h1>
        <p>Create, edit, and organize grocery categories with fresh storefront imagery.</p>
        <AdminNav active="categories" />
      </div>

      <div className="admin-shell">
        <section className="panel admin-sticky">
          <AdminActionForm action={createCategory}>
            <h2 style={{ margin: 0 }}>Add category</h2>
            <ImagePreviewInput label="Category image" />
            <label className="form-field">
              <span>Category name</span>
              <input className="field" name="name" placeholder="Fresh produce" required />
            </label>
            <label className="form-field">
              <span>Description</span>
              <textarea className="textarea" name="description" placeholder="Short category description" required />
            </label>
            <SubmitButton pendingLabel="Adding...">Add category</SubmitButton>
          </AdminActionForm>
        </section>

        <section className="admin-list">
          {categories.length === 0 ? (
            <EmptyState title="No categories yet" message="Create a category before adding grocery products." />
          ) : (
            categories.map((category) => (
              <article className="admin-card" key={category.id}>
                <div className="admin-card-media">
                  <Image alt={category.name} height={120} src={category.imageUrl} width={160} />
                </div>
                <div className="admin-card-main">
                  <div className="admin-card-head">
                    <div>
                      <p className="muted">{category._count.products} products</p>
                      <h2>{category.name}</h2>
                    </div>
                  </div>
                  <p className="muted">{category.description}</p>

                  <details className="admin-details">
                    <summary>Edit category</summary>
                    <AdminActionForm action={updateCategory.bind(null, category.id)}>
                      <ImagePreviewInput currentImage={category.imageUrl} label="Category image" />
                      <label className="form-field">
                        <span>Category name</span>
                        <input className="field" defaultValue={category.name} name="name" required />
                      </label>
                      <label className="form-field">
                        <span>Description</span>
                        <textarea className="textarea" defaultValue={category.description} name="description" required />
                      </label>
                      <SubmitButton pendingLabel="Saving..." variant="secondary">Save changes</SubmitButton>
                    </AdminActionForm>
                  </details>

                  <AdminDeleteForm action={deleteCategory.bind(null, category.id)} label="Delete category" />
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  )
}
