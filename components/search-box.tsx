"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { FormEvent, useEffect, useMemo, useState } from "react"

import { formatMoney } from "@/lib/format"

type SearchSuggestion = {
  categoryName: string
  imageUrl: string
  name: string
  priceCents: number
  slug: string
}

const groupedSuggestionCategories = ["Fruits", "Breakfast", "Drinks", "African Foods"]

export function SearchBox() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = useMemo(() => searchParams.toString(), [searchParams])
  const [query, setQuery] = useState(searchParams.get("q") ?? "")
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (pathname !== "/products") {
      return
    }

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams()
      new URLSearchParams(searchParamsString).forEach((value, key) => {
        if (key !== "q") {
          params.set(key, value)
        }
      })
      if (query.trim()) {
        params.set("q", query.trim())
      }
      router.replace(`/products${params.toString() ? `?${params}` : ""}`)
    }, 180)

    return () => window.clearTimeout(timer)
  }, [pathname, query, router, searchParamsString])

  useEffect(() => {
    if (!query.trim()) {
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal
        })
        const data = await response.json()
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([])
        }
      }
    }, 160)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  function changeQuery(value: string) {
    setQuery(value)

    if (!value.trim()) {
      setSuggestions([])
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const params = new URLSearchParams()
    new URLSearchParams(searchParamsString).forEach((value, key) => {
      if (key !== "q") {
        params.set(key, value)
      }
    })
    if (query.trim()) {
      params.set("q", query.trim())
    }
    router.push(`/products${params.toString() ? `?${params}` : ""}`)
  }

  return (
    <form className="search-form" onSubmit={submit}>
      <div className="search-input-wrap">
        <input
          aria-label="Search groceries"
          className="field"
          onBlur={() => window.setTimeout(() => setFocused(false), 140)}
          onChange={(event) => changeQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search fruit, bread, pantry..."
          value={query}
        />
        {query.trim() && focused ? (
          <div className="search-suggestions" role="listbox" aria-label="Search suggestions">
            {suggestions.length > 0 ? suggestions.map((suggestion, index) => {
              const previousCategory = suggestions[index - 1]?.categoryName
              const showCategoryLabel =
                groupedSuggestionCategories.includes(suggestion.categoryName) &&
                suggestion.categoryName !== previousCategory

              return (
                <div className="search-suggestion-group" key={suggestion.slug}>
                  {showCategoryLabel ? <p>{suggestion.categoryName}</p> : null}
                  <Link className="search-suggestion-row" href={`/products/${suggestion.slug}`}>
                    <Image alt="" height={42} src={suggestion.imageUrl} width={42} />
                    <span>
                      <strong>{suggestion.name}</strong>
                      <small>{suggestion.categoryName}</small>
                    </span>
                    <b>{formatMoney(suggestion.priceCents)}</b>
                  </Link>
                </div>
              )
            }) : (
              <button onClick={() => router.push(`/products?q=${encodeURIComponent(query.trim())}`)} type="button">
                Search for {query.trim()}
              </button>
            )}
          </div>
        ) : null}
      </div>
      <button className="button" type="submit">Search</button>
    </form>
  )
}
