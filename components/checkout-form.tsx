"use client"

import Link from "next/link"
import { CardCvcElement, CardExpiryElement, CardNumberElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js"
import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { CartItem, clearCart, readCart } from "@/lib/cart"
import { clearConfirmationCartFlag, markCartForConfirmationClear } from "@/components/clear-cart-on-confirmation"
import { calculateTaxCents, deliveryFeeForSubtotal, formatLineItem, formatMoney, freeDeliveryThresholdCents } from "@/lib/format"
import { addCalendarDays, dateInputValue, formatFulfillmentEta, parseScheduleDate, windowsForScheduleDate } from "@/lib/scheduling"

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

const cardElementOptions = {
  style: {
    base: {
      color: "#102318",
      fontFamily: "inherit",
      fontSize: "16px",
      fontSmoothing: "antialiased",
      "::placeholder": {
        color: "#7a877d"
      }
    },
    invalid: {
      color: "#b91c1c"
    }
  }
}

const cardNumberElementOptions = {
  ...cardElementOptions,
  disableLink: true
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10)

  if (digits.length <= 3) {
    return digits
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function CheckoutForm({
  deliveryFeeCents,
  deliveryFeeLabel,
  initialEmail = "",
  initialName = "",
  isLoggedIn = false,
  stripePublishableKey
}: {
  deliveryFeeCents: number
  deliveryFeeLabel: string
  initialEmail?: string
  initialName?: string
  isLoggedIn?: boolean
  stripePublishableKey: string
}) {
  const [items, setItems] = useState<CartItem[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"DELIVERY" | "PICKUP">("DELIVERY")
  const [customerName, setCustomerName] = useState(initialName)
  const [customerEmail, setCustomerEmail] = useState(initialEmail)
  const [customerPhone, setCustomerPhone] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [deliveryInstructions, setDeliveryInstructions] = useState("")
  const [scheduleChoice, setScheduleChoice] = useState<"TODAY" | "TOMORROW" | "LATER">("TODAY")
  const [laterDate, setLaterDate] = useState("")
  const [scheduledWindow, setScheduledWindow] = useState<string>(() => windowsForScheduleDate(new Date())[0] ?? "")
  const [discountCode, setDiscountCode] = useState("")
  const [appliedDiscountCode, setAppliedDiscountCode] = useState("")
  const [appliedDiscountCents, setAppliedDiscountCents] = useState(0)
  const [discountMessage, setDiscountMessage] = useState("")
  const [discountStatus, setDiscountStatus] = useState<"error" | "success" | "">("")
  const [discountLoading, setDiscountLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [paymentIntent, setPaymentIntent] = useState<{ clientSecret: string; fingerprint: string; orderId: string; token: string } | null>(null)
  const [summaryCollapsed, setSummaryCollapsed] = useState(false)
  const paymentRequestInFlightRef = useRef("")
  const summaryAutoCollapsedRef = useRef(false)
  const savedDetailsLoadedRef = useRef(false)
  const summaryRef = useRef<HTMLElement | null>(null)
  const [touched, setTouched] = useState({
    customerName: false,
    customerEmail: false,
    customerPhone: false,
    deliveryAddress: false
  })

  const subtotal = useMemo(() => Math.round(items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)), [items])
  const invalidItems = useMemo(
    () =>
      items.filter((item) => {
        const hasValidQuantity = Number.isFinite(item.quantity) && item.quantity > 0
        const hasValidIncrement =
          item.saleUnit === "LB" ? Number.isInteger(item.quantity * 2) : Number.isInteger(item.quantity)
        return !hasValidQuantity || !hasValidIncrement || item.stock <= 0 || item.quantity > item.stock
      }),
    [items]
  )
  const deliveryIsFree = subtotal >= freeDeliveryThresholdCents()
  const freeDeliveryRemainingCents = Math.max(0, freeDeliveryThresholdCents() - subtotal)
  const activeDeliveryFee = fulfillmentMethod === "DELIVERY" ? deliveryFeeForSubtotal(subtotal, deliveryFeeCents) : 0
  const discountCents = Math.min(subtotal, appliedDiscountCents)
  const taxableSubtotal = useMemo(
    () => Math.round(items.filter((item) => item.taxable).reduce((sum, item) => sum + item.priceCents * item.quantity, 0)),
    [items]
  )
  const estimatedTaxableDiscount = subtotal > 0 ? Math.round(discountCents * (taxableSubtotal / subtotal)) : 0
  const taxCents = calculateTaxCents(Math.max(0, taxableSubtotal - estimatedTaxableDiscount))
  const total = Math.max(0, subtotal - discountCents) + taxCents + activeDeliveryFee
  const itemCount = items.length
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())
  const todayDate = useMemo(() => new Date(), [])
  const todayInput = dateInputValue(todayDate)
  const tomorrowInput = dateInputValue(addCalendarDays(todayDate, 1))
  const selectedDateInput = scheduleChoice === "TODAY" ? todayInput : scheduleChoice === "TOMORROW" ? tomorrowInput : laterDate
  const selectedScheduleDate = useMemo(() => parseScheduleDate(selectedDateInput), [selectedDateInput])
  const availableScheduleWindows = useMemo(
    () => selectedScheduleDate ? windowsForScheduleDate(selectedScheduleDate) : [],
    [selectedScheduleDate]
  )
  const scheduleLabel = selectedScheduleDate && scheduledWindow
    ? formatFulfillmentEta(fulfillmentMethod, selectedScheduleDate, scheduledWindow, todayDate)
    : ""
  const compactScheduleLabel = scheduleLabel.replace(" between ", " ")
  const phoneDigits = customerPhone.replace(/\D/g, "")
  const validationErrors = {
    customerName: customerName.trim().length >= 2 ? "" : "Enter your full name.",
    customerEmail: emailIsValid ? "" : "Enter a valid email address.",
    customerPhone:
      fulfillmentMethod === "DELIVERY" && phoneDigits.length < 7
        ? "Enter a phone number for delivery updates."
        : "",
    deliveryAddress:
      fulfillmentMethod === "DELIVERY" && deliveryAddress.trim().length < 5
        ? "Enter a local delivery address."
        : "",
    scheduledDate: selectedScheduleDate ? "" : "Choose a delivery or pickup date.",
    scheduledWindow: scheduledWindow ? "" : "Choose a delivery or pickup window."
  }
  const checkoutDetailsAreValid = !validationErrors.customerName &&
    !validationErrors.customerEmail &&
    !validationErrors.customerPhone &&
    !validationErrors.deliveryAddress &&
    !validationErrors.scheduledDate &&
    !validationErrors.scheduledWindow
  const freeDeliveryProgress = Math.min(100, Math.round((subtotal / freeDeliveryThresholdCents()) * 100))
  const checkoutDetailsStorageKey = initialEmail ? `freshcart-checkout-details:${initialEmail.toLowerCase()}` : ""
  const paymentFingerprint = useMemo(
    () => JSON.stringify({
      appliedDiscountCode,
      customerEmail: customerEmail.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryAddress: deliveryAddress.trim(),
      deliveryInstructions: deliveryInstructions.trim(),
      fulfillmentMethod,
      items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
      scheduledWindow,
      selectedDateInput
    }),
    [
      appliedDiscountCode,
      customerEmail,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryInstructions,
      fulfillmentMethod,
      items,
      scheduledWindow,
      selectedDateInput
    ]
  )
  const activePaymentIntent = paymentIntent?.fingerprint === paymentFingerprint ? paymentIntent : null
  const hasUnappliedDiscount = Boolean(discountCode.trim() && !appliedDiscountCode)
  const stripeOptions = useMemo<StripeElementsOptions | null>(
    () => activePaymentIntent
      ? {
          appearance: {
            theme: "stripe",
            variables: {
              borderRadius: "12px",
              colorPrimary: "#15803D",
              fontFamily: "inherit"
            }
          },
          clientSecret: activePaymentIntent.clientSecret
        }
      : null,
    [activePaymentIntent]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => setItems(readCart()), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (savedDetailsLoadedRef.current || !isLoggedIn || !checkoutDetailsStorageKey) {
      return
    }

    savedDetailsLoadedRef.current = true

    try {
      const saved = window.localStorage.getItem(checkoutDetailsStorageKey)
      if (!saved) {
        return
      }

      const parsed = JSON.parse(saved) as {
        customerPhone?: string
        deliveryAddress?: string
        deliveryInstructions?: string
      }

      const timer = window.setTimeout(() => {
        if (!customerPhone && parsed.customerPhone) {
          setCustomerPhone(formatPhoneNumber(parsed.customerPhone))
        }

        if (!deliveryAddress && parsed.deliveryAddress) {
          setDeliveryAddress(parsed.deliveryAddress)
        }

        if (!deliveryInstructions && parsed.deliveryInstructions) {
          setDeliveryInstructions(parsed.deliveryInstructions)
        }
      }, 0)

      return () => window.clearTimeout(timer)
    } catch {
      window.localStorage.removeItem(checkoutDetailsStorageKey)
    }
  }, [checkoutDetailsStorageKey, customerPhone, deliveryAddress, deliveryInstructions, isLoggedIn])

  useEffect(() => {
    const collapseAfterScroll = () => {
      if (summaryAutoCollapsedRef.current || window.innerWidth >= 720 || !summaryRef.current) {
        return
      }

      if (summaryRef.current.getBoundingClientRect().top < -24) {
        summaryAutoCollapsedRef.current = true
        setSummaryCollapsed(true)
      }
    }

    window.addEventListener("scroll", collapseAfterScroll, { passive: true })
    window.addEventListener("resize", collapseAfterScroll)
    collapseAfterScroll()

    return () => {
      window.removeEventListener("scroll", collapseAfterScroll)
      window.removeEventListener("resize", collapseAfterScroll)
    }
  }, [])

  function syncScheduleWindow(dateInput: string) {
    const date = parseScheduleDate(dateInput)
    const windows = date ? windowsForScheduleDate(date) : []
    setScheduledWindow(windows[0] ?? "")
  }

  const saveCheckoutDetails = useCallback(() => {
    if (!isLoggedIn || !checkoutDetailsStorageKey) {
      return
    }

    window.localStorage.setItem(
      checkoutDetailsStorageKey,
      JSON.stringify({
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        deliveryInstructions: deliveryInstructions.trim()
      })
    )
  }, [checkoutDetailsStorageKey, customerPhone, deliveryAddress, deliveryInstructions, isLoggedIn])

  function changeDiscountCode(value: string) {
    const nextCode = value.toUpperCase()
    setDiscountCode(nextCode)

    if (appliedDiscountCode && nextCode.trim() !== appliedDiscountCode) {
      setAppliedDiscountCode("")
      setAppliedDiscountCents(0)
      setDiscountStatus("")
      setDiscountMessage("")
    }
  }

  const preparePaymentIntent = useCallback(async (fingerprint: string) => {
    setSubmitted(true)

    if (items.length === 0) {
      setError("Add groceries to your cart before checkout.")
      return
    }

    if (!checkoutDetailsAreValid) {
      setError("Please complete the required checkout details.")
      return
    }

    if (invalidItems.length > 0) {
      setError("Please remove or adjust out-of-stock items before checkout.")
      return
    }

    if (hasUnappliedDiscount) {
      setError("Please apply or remove the discount code before payment.")
      return
    }

    if (!stripePublishableKey) {
      setError("Stripe payment form is not configured.")
      return
    }

    if (activePaymentIntent || paymentRequestInFlightRef.current === fingerprint) {
      return
    }

    paymentRequestInFlightRef.current = fingerprint
    saveCheckoutDetails()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone: customerPhone.trim(),
          fulfillmentMethod,
          deliveryAddress: fulfillmentMethod === "DELIVERY" ? deliveryAddress : "",
          deliveryInstructions: fulfillmentMethod === "DELIVERY" ? deliveryInstructions : "",
          scheduledDate: selectedDateInput,
          scheduledWindow,
          discountCode: appliedDiscountCode || undefined,
          items: items.map(({ id, quantity }) => ({ id, quantity }))
        })
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Checkout failed. Please try again.")
        setLoading(false)
        return
      }

      if (!data.clientSecret || !data.orderId || !data.token) {
        setError("Checkout could not start the secure payment form.")
        setLoading(false)
        return
      }

      setPaymentIntent({
        clientSecret: data.clientSecret,
        fingerprint,
        orderId: data.orderId,
        token: data.token
      })
      setLoading(false)
    } catch {
      setError("Checkout failed. Please try again.")
      setLoading(false)
    } finally {
      if (paymentRequestInFlightRef.current === fingerprint) {
        paymentRequestInFlightRef.current = ""
      }
    }
  }, [
    activePaymentIntent,
    appliedDiscountCode,
    customerEmail,
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryInstructions,
    checkoutDetailsAreValid,
    fulfillmentMethod,
    hasUnappliedDiscount,
    invalidItems.length,
    items,
    saveCheckoutDetails,
    scheduledWindow,
    selectedDateInput,
    stripePublishableKey
  ])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void preparePaymentIntent(paymentFingerprint)
  }

  useEffect(() => {
    if (
      activePaymentIntent ||
      !checkoutDetailsAreValid ||
      hasUnappliedDiscount ||
      invalidItems.length > 0 ||
      items.length === 0 ||
      loading ||
      !stripePublishableKey
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void preparePaymentIntent(paymentFingerprint)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [
    activePaymentIntent,
    checkoutDetailsAreValid,
    hasUnappliedDiscount,
    invalidItems.length,
    items.length,
    loading,
    paymentFingerprint,
    preparePaymentIntent,
    stripePublishableKey
  ])

  async function applyDiscount() {
    setDiscountMessage("")
    setDiscountStatus("")
    setAppliedDiscountCode("")
    setAppliedDiscountCents(0)
    if (!discountCode.trim()) {
      setDiscountMessage("Enter a discount code.")
      setDiscountStatus("error")
      return
    }

    setDiscountLoading(true)
    try {
      const response = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: discountCode,
          items: items.map(({ id, quantity }) => ({ id, quantity }))
        })
      })
      const data = await response.json()
      if (!response.ok) {
        setDiscountMessage(data.error ?? "Discount code could not be applied.")
        setDiscountStatus("error")
        setDiscountLoading(false)
        return
      }

      setDiscountMessage(data.message ?? "Discount applied.")
      setDiscountStatus("success")
      setAppliedDiscountCode(discountCode.trim().toUpperCase())
      setAppliedDiscountCents(Number(data.discountCents ?? 0))
      setDiscountLoading(false)
    } catch {
      setDiscountMessage("Discount code could not be applied.")
      setDiscountStatus("error")
      setDiscountLoading(false)
    }
  }

  function removeDiscount() {
    setAppliedDiscountCode("")
    setAppliedDiscountCents(0)
    setDiscountMessage("")
    setDiscountStatus("")
    setDiscountCode("")
  }

  if (items.length === 0) {
    return (
      <section className="panel empty-state">
        <h3>Your Cart Is Empty</h3>
        <p className="muted">Add groceries to your basket before starting checkout.</p>
        <button className="button" disabled type="button">Checkout</button>
        <Link className="button secondary" href="/products">Start shopping</Link>
      </section>
    )
  }

  return (
    <div className="two-col checkout-layout">
      <form className="panel form-grid checkout-form-panel" onSubmit={submit}>
        <section className="checkout-section checkout-section-customer">
          <div className="checkout-section-head">
            <h2>Customer information</h2>
            <p>We will use this for order updates and your receipt.</p>
          </div>
        <label className="form-field checkout-customer-field">
          <span>Full name</span>
          <input
            aria-invalid={Boolean((submitted || touched.customerName) && validationErrors.customerName)}
            className="field"
            name="customerName"
            onBlur={() => setTouched((current) => ({ ...current, customerName: true }))}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Full name"
            required
            value={customerName}
          />
          {(submitted || touched.customerName) && validationErrors.customerName ? (
            <small className="field-error">{validationErrors.customerName}</small>
          ) : null}
        </label>
        <label className="form-field checkout-customer-field">
          <span>Email</span>
          <input
            aria-invalid={Boolean((submitted || touched.customerEmail) && validationErrors.customerEmail)}
            className="field"
            name="customerEmail"
            onBlur={() => setTouched((current) => ({ ...current, customerEmail: true }))}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="Email"
            required
            type="email"
            value={customerEmail}
          />
          {(submitted || touched.customerEmail) && validationErrors.customerEmail ? (
            <small className="field-error">{validationErrors.customerEmail}</small>
          ) : null}
        </label>
        <label className="form-field checkout-customer-field">
          <span>Phone number {fulfillmentMethod === "DELIVERY" ? "(required for delivery)" : "(optional)"}</span>
          <input
            aria-invalid={Boolean((submitted || touched.customerPhone) && validationErrors.customerPhone)}
            className="field"
            name="customerPhone"
            onBlur={() => setTouched((current) => ({ ...current, customerPhone: true }))}
            onChange={(event) => setCustomerPhone(formatPhoneNumber(event.target.value))}
            placeholder="(555) 555-5555"
            required={fulfillmentMethod === "DELIVERY"}
            type="tel"
            value={customerPhone}
          />
          {(submitted || touched.customerPhone) && validationErrors.customerPhone ? (
            <small className="field-error">{validationErrors.customerPhone}</small>
          ) : null}
        </label>
        </section>
        <section className="checkout-section checkout-section-fulfillment">
          <div className="checkout-section-head">
            <h2>Delivery or pickup</h2>
            <p>Choose how and when you want your groceries.</p>
          </div>
        <div className="segmented-control checkout-fulfillment-toggle" role="group" aria-label="Fulfillment method">
          <button
            className={fulfillmentMethod === "DELIVERY" ? "active" : ""}
            onClick={() => setFulfillmentMethod("DELIVERY")}
            type="button"
          >
            <span aria-hidden="true">🚚</span> Delivery
          </button>
          <button
            className={fulfillmentMethod === "PICKUP" ? "active" : ""}
            onClick={() => setFulfillmentMethod("PICKUP")}
            type="button"
          >
            <span aria-hidden="true">🛍️</span> Pickup
          </button>
        </div>
        <div className="form-grid compact-form-grid checkout-schedule-grid">
          <label className="form-field">
            <span>{fulfillmentMethod === "DELIVERY" ? "Delivery date" : "Pickup date"}</span>
            <select
              className="select"
              name="scheduleChoice"
              onChange={(event) => {
                const nextChoice = event.target.value as "TODAY" | "TOMORROW" | "LATER"
                setScheduleChoice(nextChoice)
                syncScheduleWindow(nextChoice === "TODAY" ? todayInput : nextChoice === "TOMORROW" ? tomorrowInput : laterDate)
              }}
              value={scheduleChoice}
            >
              <option value="TODAY">Today</option>
              <option value="TOMORROW">Tomorrow</option>
              <option value="LATER">Later date</option>
            </select>
          </label>
          {scheduleChoice === "LATER" ? (
            <label className="form-field">
              <span>Later date</span>
              <input
                className="field"
                min={todayInput}
                name="scheduledDate"
                onChange={(event) => {
                  setLaterDate(event.target.value)
                  syncScheduleWindow(event.target.value)
                }}
                required
                type="date"
                value={laterDate}
              />
              {submitted && validationErrors.scheduledDate ? (
                <small className="field-error">{validationErrors.scheduledDate}</small>
              ) : null}
            </label>
          ) : null}
          <label className="form-field">
            <span>{fulfillmentMethod === "DELIVERY" ? "Delivery window" : "Pickup window"}</span>
            <select
              className="select"
              name="scheduledWindow"
              onChange={(event) => setScheduledWindow(event.target.value)}
              required
              value={scheduledWindow}
            >
              {availableScheduleWindows.map((window) => (
                <option key={window} value={window}>{window}</option>
              ))}
            </select>
            {submitted && validationErrors.scheduledWindow ? (
              <small className="field-error">{validationErrors.scheduledWindow}</small>
            ) : null}
          </label>
        </div>
        </section>
        <section className="checkout-section checkout-section-address fulfillment-details">
          <div className="checkout-section-head">
            <h2>{fulfillmentMethod === "DELIVERY" ? "Delivery address" : "Pickup details"}</h2>
            <p>{fulfillmentMethod === "DELIVERY" ? "Add a local address and any helpful dropoff notes." : "We will prepare your order for in-store pickup."}</p>
          </div>
          {fulfillmentMethod === "DELIVERY" ? (
            <>
              <label className="form-field">
                <span>Delivery address</span>
                <textarea
                  aria-invalid={Boolean((submitted || touched.deliveryAddress) && validationErrors.deliveryAddress)}
                  className="textarea"
                  name="deliveryAddress"
                  onBlur={() => setTouched((current) => ({ ...current, deliveryAddress: true }))}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  placeholder="Local delivery address"
                  required
                  value={deliveryAddress}
                />
                {(submitted || touched.deliveryAddress) && validationErrors.deliveryAddress ? (
                  <small className="field-error">{validationErrors.deliveryAddress}</small>
                ) : null}
              </label>
              <label className="form-field">
                <span>Delivery instructions</span>
                <textarea
                  className="textarea"
                  maxLength={500}
                  name="deliveryInstructions"
                  onChange={(event) => setDeliveryInstructions(event.target.value)}
                  placeholder="Gate code, apartment details, or dropoff notes"
                  value={deliveryInstructions}
                />
              </label>
            </>
          ) : (
            <p className="form-note pickup-note">Pickup ready in 20-30 min</p>
          )}
        </section>
        <section className="checkout-section checkout-section-discount">
          <div className="checkout-section-head">
            <h2>Discount code</h2>
            <p>Apply a code before continuing to payment.</p>
          </div>
        <label className="form-field checkout-discount-field">
          <span>Code</span>
          <input
            className="field"
            disabled={Boolean(appliedDiscountCode)}
            name="discountCode"
            onChange={(event) => changeDiscountCode(event.target.value)}
            placeholder="FRESH10"
            value={discountCode}
          />
          {discountMessage ? <small className={discountStatus === "success" ? "field-success" : "field-error"}>{discountMessage}</small> : null}
        </label>
        {appliedDiscountCode ? (
          <button className="button secondary checkout-discount-action" onClick={removeDiscount} type="button">Remove code</button>
        ) : (
          <button
            className={`button secondary checkout-discount-action ${!discountCode.trim() ? "is-idle" : ""}`}
            disabled={discountLoading || !discountCode.trim()}
            onClick={applyDiscount}
            type="button"
          >
            {discountLoading ? "Applying..." : "Apply code"}
          </button>
        )}
        </section>
        <section className="checkout-section checkout-section-payment">
          <div className="checkout-section-head">
            <h2>Payment</h2>
            <p>Enter your card details below.</p>
          </div>
          <div className="checkout-trust-badges" aria-label="Checkout trust badges">
            <span><span aria-hidden="true">✓</span> Secure Stripe Checkout</span>
            <span><span aria-hidden="true">✓</span> Freshness Guaranteed</span>
            <span><span aria-hidden="true">✓</span> Local Delivery Available</span>
          </div>
        {error ? <p className="checkout-error-message" role="alert" style={{ color: "#b91c1c", margin: 0 }}>{error}</p> : null}
        {invalidItems.length > 0 ? (
          <p className="form-note warning checkout-error-message">Some items are no longer available in the requested quantity.</p>
        ) : null}
        {activePaymentIntent && stripePromise && stripeOptions ? (
          <Elements key={activePaymentIntent.clientSecret} options={stripeOptions} stripe={stripePromise}>
            <EmbeddedPaymentForm
              acceptedTerms={acceptedTerms}
              clientSecret={activePaymentIntent.clientSecret}
              disabled={invalidItems.length > 0 || !checkoutDetailsAreValid}
              onError={setError}
              orderId={activePaymentIntent.orderId}
              token={activePaymentIntent.token}
            >
              <TermsCheckbox acceptedTerms={acceptedTerms} setAcceptedTerms={setAcceptedTerms} />
            </EmbeddedPaymentForm>
          </Elements>
        ) : (
          <>
            <div className="payment-element-placeholder" aria-live="polite">
              {loading
                ? "Loading secure payment fields..."
                : "Enter your contact and delivery details above to unlock secure card payment."}
            </div>
            <TermsCheckbox acceptedTerms={acceptedTerms} setAcceptedTerms={setAcceptedTerms} />
          </>
        )}
        <p className="checkout-refund-notice">
          Freshness guaranteed. Report any damaged, missing, or incorrect items within 24 hours for refund or replacement assistance.
        </p>
        </section>
      </form>
      <aside className={`panel checkout-summary-panel ${summaryCollapsed ? "is-collapsed" : ""}`} ref={summaryRef}>
        <button
          aria-expanded={!summaryCollapsed}
          className="mobile-summary-toggle"
          onClick={() => setSummaryCollapsed((current) => !current)}
          type="button"
        >
          <span>
            <strong>{formatMoney(total)}</strong>
            <small>{itemCount} {itemCount === 1 ? "item" : "items"}</small>
          </span>
          <span>{compactScheduleLabel}</span>
          <span aria-hidden="true" className="summary-chevron">{summaryCollapsed ? "⌄" : "⌃"}</span>
        </button>
        <div className="checkout-summary-details">
          <div className="summary-heading">
            <h2>Order summary</h2>
            <p>Review your items before payment.</p>
          </div>
          {items.map((item) => (
            <div className="summary-line" key={item.id}>
              <span>{formatLineItem(item.name, item.quantity, item.priceCents, item.saleUnit)}</span>
              <strong>{formatMoney(Math.round(item.priceCents * item.quantity))}</strong>
            </div>
          ))}
          {scheduleLabel ? (
            <div className="summary-line delivery-eta">
              <span>{fulfillmentMethod === "DELIVERY" ? "Delivery ETA" : "Pickup ETA"}</span>
              <strong><span aria-hidden="true" />{compactScheduleLabel}</strong>
            </div>
          ) : null}
          {fulfillmentMethod === "DELIVERY" ? (
            <p className={`free-delivery-note ${deliveryIsFree ? "unlocked" : ""}`}>
              {deliveryIsFree ? "Free delivery unlocked" : "Free delivery on orders $100+"}
            </p>
          ) : null}
          <div className="summary-line">
            <span>Subtotal</span>
            <strong>{formatMoney(subtotal)}</strong>
          </div>
          {discountCents > 0 ? (
            <div className="summary-line">
              <span>Discount{appliedDiscountCode ? ` (${appliedDiscountCode})` : ""}</span>
              <strong>-{formatMoney(discountCents)}</strong>
            </div>
          ) : null}
          <div className="summary-line">
            <span>Tax</span>
            <strong>{formatMoney(taxCents)}</strong>
          </div>
          {fulfillmentMethod === "DELIVERY" ? (
            <div className="summary-line">
              <span>Delivery fee</span>
              <strong>{activeDeliveryFee === 0 ? formatMoney(0) : deliveryFeeLabel}</strong>
            </div>
          ) : null}
          {fulfillmentMethod === "DELIVERY" ? (
            <>
              <p className={`delivery-fee-helper ${deliveryIsFree ? "unlocked" : ""}`}>
                {deliveryIsFree
                  ? "You unlocked free delivery"
                  : `You're ${formatMoney(freeDeliveryRemainingCents)} away from free delivery`}
              </p>
              <div className="free-delivery-progress" aria-hidden="true">
                <span style={{ width: `${freeDeliveryProgress}%` }} />
              </div>
            </>
          ) : null}
          <div className="summary-line total">
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </div>
        </div>
      </aside>
    </div>
  )
}

function TermsCheckbox({
  acceptedTerms,
  setAcceptedTerms
}: {
  acceptedTerms: boolean
  setAcceptedTerms: (accepted: boolean) => void
}) {
  return (
    <label className="checkout-terms-check">
      <input
        checked={acceptedTerms}
        onChange={(event) => setAcceptedTerms(event.target.checked)}
        type="checkbox"
      />
      <span>
        I agree to the <Link href="/terms">Terms & Conditions</Link> and understand the <Link href="/refund-policy">Refund Policy</Link>.
      </span>
    </label>
  )
}

function EmbeddedPaymentForm({
  acceptedTerms,
  children,
  clientSecret,
  disabled,
  onError,
  orderId,
  token
}: {
  acceptedTerms: boolean
  children: ReactNode
  clientSecret: string
  disabled: boolean
  onError: (message: string) => void
  orderId: string
  token: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [confirming, setConfirming] = useState(false)
  const [billingCountry, setBillingCountry] = useState("US")
  const [billingPostalCode, setBillingPostalCode] = useState("")

  async function confirmOrder() {
    if (!acceptedTerms) {
      onError("Please accept the Terms & Conditions and Refund Policy before placing your order.")
      return
    }

    if (!stripe || !elements) {
      onError("Stripe payment form is still loading.")
      return
    }

    const cardNumber = elements.getElement(CardNumberElement)
    if (!cardNumber) {
      onError("Card fields are still loading.")
      return
    }

    if (!billingPostalCode.trim()) {
      onError("Enter your billing ZIP or postal code.")
      return
    }

    setConfirming(true)
    onError("")

    const confirmationUrl = `${window.location.origin}/order-confirmation?order=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`
    markCartForConfirmationClear()
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        billing_details: {
          address: {
            country: billingCountry,
            postal_code: billingPostalCode.trim()
          }
        },
        card: cardNumber
      },
      return_url: confirmationUrl
    })

    if (result.error) {
      clearConfirmationCartFlag()
      onError(result.error.message ?? "Payment failed. Please check your payment details.")
      setConfirming(false)
      return
    }

    if (result.paymentIntent?.status === "succeeded" || result.paymentIntent?.status === "processing") {
      clearCart()
      clearConfirmationCartFlag()
      window.location.href = `${confirmationUrl}&payment_intent=${encodeURIComponent(result.paymentIntent.id)}`
      return
    }

    clearConfirmationCartFlag()
    onError("Payment could not be completed. Please try again.")
    setConfirming(false)
  }

  return (
    <div className="embedded-payment">
      <div className="stripe-card-fields">
        <label className="stripe-card-field stripe-card-field-full">
          <span>Card number</span>
          <div className="stripe-card-control">
            <CardNumberElement options={cardNumberElementOptions} />
          </div>
        </label>
        <label className="stripe-card-field">
          <span>Expiration date</span>
          <div className="stripe-card-control">
            <CardExpiryElement options={cardElementOptions} />
          </div>
        </label>
        <label className="stripe-card-field">
          <span>CVC</span>
          <div className="stripe-card-control">
            <CardCvcElement options={cardElementOptions} />
          </div>
        </label>
        <label className="stripe-card-field">
          <span>Country</span>
          <select
            className="stripe-card-input"
            onChange={(event) => setBillingCountry(event.target.value)}
            value={billingCountry}
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
        </label>
        <label className="stripe-card-field">
          <span>ZIP code</span>
          <input
            className="stripe-card-input"
            inputMode="text"
            onChange={(event) => setBillingPostalCode(event.target.value)}
            placeholder="ZIP or postal code"
            value={billingPostalCode}
          />
        </label>
      </div>
      {children}
      <button
        className="button checkout-pay-button"
        disabled={disabled || confirming || !stripe || !elements}
        onClick={confirmOrder}
        type="button"
      >
        {confirming ? "Placing order..." : "Place Order"}
      </button>
    </div>
  )
}
