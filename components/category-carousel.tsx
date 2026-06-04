"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

type CategoryCarouselItem = {
  href: string
  icon: string
  name: string
}

export function CategoryCarousel({ items }: { items: CategoryCarouselItem[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function updateScrollState() {
    const scroller = scrollerRef.current
    if (!scroller) {
      return
    }

    setCanScrollLeft(scroller.scrollLeft > 4)
    setCanScrollRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4)
  }

  function scrollByPage(direction: -1 | 1) {
    const scroller = scrollerRef.current
    if (!scroller) {
      return
    }

    scroller.scrollBy({
      left: direction * Math.max(220, scroller.clientWidth * 0.75),
      behavior: "smooth"
    })
  }

  useEffect(() => {
    updateScrollState()
    const scroller = scrollerRef.current
    if (!scroller) {
      return
    }

    scroller.addEventListener("scroll", updateScrollState, { passive: true })
    window.addEventListener("resize", updateScrollState)
    return () => {
      scroller.removeEventListener("scroll", updateScrollState)
      window.removeEventListener("resize", updateScrollState)
    }
  }, [])

  useEffect(() => {
    if (isPaused) {
      return
    }

    const timer = window.setInterval(() => {
      const scroller = scrollerRef.current
      if (!scroller || scroller.scrollWidth <= scroller.clientWidth) {
        return
      }

      if (scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4) {
        scroller.scrollTo({ left: 0, behavior: "smooth" })
      } else {
        scroller.scrollBy({ left: 120, behavior: "smooth" })
      }
    }, 3500)

    return () => window.clearInterval(timer)
  }, [isPaused])

  return (
    <div
      className={`category-carousel-shell ${canScrollLeft ? "has-left" : ""} ${canScrollRight ? "has-right" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsPaused(false)
        }
      }}
      onFocus={() => setIsPaused(true)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {canScrollLeft ? (
        <button
          aria-label="Scroll categories left"
          className="category-arrow left"
          onClick={() => scrollByPage(-1)}
          type="button"
        >
          {"<"}
        </button>
      ) : null}
      <div className="category-carousel top-category-bar" ref={scrollerRef}>
        {items.map((item) => (
          <Link className="category-tile" href={item.href} key={item.name}>
            <span>{item.icon}</span>
            <strong>{item.name}</strong>
          </Link>
        ))}
      </div>
      {canScrollRight ? (
        <button
          aria-label="Scroll categories right"
          className="category-arrow right"
          onClick={() => scrollByPage(1)}
          type="button"
        >
          {">"}
        </button>
      ) : null}
    </div>
  )
}
