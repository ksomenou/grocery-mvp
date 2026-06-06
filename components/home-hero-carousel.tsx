"use client"

import Link from "next/link"
import Image from "next/image"
import { type SyntheticEvent, useEffect, useState } from "react"

import { deliveryStatusForDate } from "@/lib/delivery-status"
import { discountedPriceCents, formatUnitPrice, titleCase } from "@/lib/format"
import { storeName } from "@/lib/store"

type HeroProduct = {
  id: string
  name: string
  slug: string
  description: string
  imageUrl: string
  priceCents: number
  discountPercent?: number | null
  discountType?: "NONE" | "PERCENT" | "FIXED" | null
  discountValue?: number | null
  saleUnit: "EACH" | "LB"
  category: {
    name: string
    slug: string
  }
}

function heroDescription(product: HeroProduct) {
  return `${titleCase(product.category.name)} pick ready for delivery or pickup today. A ${storeName} favorite for your next grocery run.`
}

type HeroImageFit = "cover" | "contain" | "wide"

const lcpHeroImageSrcs = new Set([
  "/uploads/1780067938968-screenshot-2026-05-26-111618.png",
  "/uploads/1779808012256-screenshot-2026-05-26-104430.png"
])

function heroImageFit(product: HeroProduct): HeroImageFit {
  const value = `${product.name} ${product.category.name} ${product.imageUrl}`.toLowerCase()
  const isFoodPile = /yam|sweet potato|potato|meat|goat|seafood|fish|produce|fruit|vegetable|banana|avocado/.test(value)
  const isTallPackaging = /milk|palm oil|oil|cereal|corn flakes|box|bottle|carton|yogurt|packaged/.test(value)
  const isWideLandscape = /ketchup|water|shelf|landscape|banner|wide/.test(value)

  if (isWideLandscape) {
    return "wide"
  }

  if (isTallPackaging) {
    return "contain"
  }

  if (isFoodPile) {
    return "cover"
  }

  return "contain"
}

export function HomeHeroCarousel({ activeProductCount, products }: { activeProductCount: number; products: HeroProduct[] }) {
  const [active, setActive] = useState(0)
  const [imageFits, setImageFits] = useState<Record<string, HeroImageFit>>({})
  const [isPaused, setIsPaused] = useState(false)
  const status = deliveryStatusForDate()

  useEffect(() => {
    if (isPaused || products.length === 0) {
      return
    }

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % products.length)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [isPaused, products.length])

  function showPrevious() {
    setActive((current) => (current - 1 + products.length) % products.length)
  }

  function showNext() {
    setActive((current) => (current + 1) % products.length)
  }

  function updateImageFit(product: HeroProduct, event: SyntheticEvent<HTMLImageElement>) {
    const typeFit = heroImageFit(product)
    if (typeFit !== "cover") {
      setImageFits((current) => (current[product.id] === typeFit ? current : { ...current, [product.id]: typeFit }))
      return
    }

    const image = event.currentTarget
    const ratio = image.naturalWidth / image.naturalHeight
    const fit: HeroImageFit = ratio > 1.65 ? "wide" : ratio < 1.28 ? "contain" : "cover"
    setImageFits((current) => (current[product.id] === fit ? current : { ...current, [product.id]: fit }))
  }

  if (products.length === 0) {
    return null
  }

  return (
    <section
      className="home-hero-carousel"
      aria-label="Featured promotions"
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          setIsPaused(false)
        }
      }}
      onFocus={() => setIsPaused(true)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <p className="store-status">{status.deliveryLabel} • {status.pickupLabel}</p>
      <div className="home-hero-window">
        <div className="home-hero-track" style={{ transform: `translateX(-${active * 100}%)` }}>
          {products.map((product, index) => {
            const isPriorityImage = index === 0 || lcpHeroImageSrcs.has(product.imageUrl)
            const imageFit = imageFits[product.id] ?? heroImageFit(product)

            return (
              <Link
                className={`home-hero-slide ${index === active ? "active" : ""}`}
                href={`/products/${product.slug}`}
                key={product.id}
              >
                <div className="hero-copy-block">
                  <span>{titleCase(product.category.name)}</span>
                  <h2>{titleCase(product.name)}</h2>
                  <p>{heroDescription(product)}</p>
                  <div className="hero-trust-badges" aria-label={`${storeName} benefits`}>
                    <span>Fresh daily</span>
                    <span>Local delivery</span>
                    <span>Pickup available</span>
                    <span>Secure checkout</span>
                  </div>
                  <div className="hero-stats" aria-label="Store stats">
                    <strong>{activeProductCount} active products</strong>
                    <strong>Pickup available</strong>
                  </div>
                  <strong className="hero-cta">Shop now - {formatUnitPrice(discountedPriceCents(product.priceCents, product.discountType, product.discountValue, product.discountPercent), product.saleUnit)}</strong>
                </div>
                <div className={`hero-visual ${imageFit} relative`} aria-hidden="true">
                  <Image
                    alt=""
                    className={`hero-image ${imageFit}`}
                    fill
                    onLoad={(event) => updateImageFit(product, event)}
                    priority={isPriorityImage}
                    sizes="(min-width: 1040px) 45vw, (min-width: 720px) 42vw, 82vw"
                    src={product.imageUrl}
                  />
                </div>
              </Link>
            )
          })}
        </div>
        <button aria-label="Show previous promotion" className="hero-arrow left" onClick={showPrevious} type="button">
          {"<"}
        </button>
        <button aria-label="Show next promotion" className="hero-arrow right" onClick={showNext} type="button">
          {">"}
        </button>
      </div>
      <div className="hero-dots" aria-label="Promotion controls">
        {products.map((item, index) => (
          <button
            aria-label={`Show promotion ${index + 1}`}
            aria-current={index === active ? "true" : undefined}
            className={index === active ? "active" : ""}
            key={item.id}
            onClick={() => setActive(index)}
            type="button"
          />
        ))}
      </div>
    </section>
  )
}
