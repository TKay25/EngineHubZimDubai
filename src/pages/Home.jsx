import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EngineFinder from "../components/EngineFinder";
import { api, money } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LoadingState } from "../components/Loading";
import toyota1kdPhoto from "../../marketing/posters/assets/toyota-1kd-ftv.jpg";
import mitsubishi4d56Photo from "../../marketing/posters/assets/mitsubishi-4d56.jpg";
import nissanYd25Photo from "../../marketing/posters/assets/nissan-yd25.jpg";

const HERO_SLIDES = [
  {
    image: toyota1kdPhoto,
    imageCredit: "Iamjosemon",
    imageSource: "https://commons.wikimedia.org/wiki/File:Toyota_1KD-FTV_Engine.jpg",
    imageLicense: "CC BY 4.0",
    imageLicenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    eyebrow: "Engine sourcing, made personal",
    title: "Your next engine.",
    accent: "Sourced, not stocked.",
    description:
      "Share your engine code, VIN or vehicle details. Our Dubai team checks suppliers and searches local garages if needed.",
  },
  {
    image: mitsubishi4d56Photo,
    imageCredit: "Mr.choppers",
    imageSource: "https://commons.wikimedia.org/wiki/File:1991_Mitsubishi_Pajero_2.5TD_Wagon_4D56_engine.jpg",
    imageLicense: "CC BY-SA 3.0",
    imageLicenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    eyebrow: "Dubai search. Clear answers.",
    title: "The right match.",
    accent: "Starts with a search.",
    description:
      "We confirm the specification and availability, then share a full landed quote so you can review the costs before deciding.",
  },
  {
    image: nissanYd25Photo,
    imageCredit: "AIMHO'S REBELLION 8490s",
    imageSource:
      "https://commons.wikimedia.org/wiki/File:2021_Nissan_Terra_2.5_diesel_Premium_4WD_red_engine_view_in_Brunei.jpg",
    imageLicense: "CC BY-SA 4.0",
    imageLicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    eyebrow: "From Dubai to Zimbabwe",
    title: "One clear journey.",
    accent: "All the way home.",
    description:
      "Approve a suitable engine and pay its deposit to reserve it. After it arrives in Zimbabwe, our mechanics can fit or mount it in your vehicle as an optional service.",
  },
];

const ROUTE_STEPS = [
  ["01", "Tell us what you need", "Engine code, VIN or vehicle details."],
  ["02", "We search in Dubai", "Suppliers first; garages if needed."],
  ["03", "You approve and reserve", "A deposit secures the available engine."],
  ["04", "We ship it home", "Our Zimbabwe mechanics can fit or mount it in your vehicle after arrival (optional service)."],
];

const STEPS = [
  ["Tell us what you need", "Nothing is held in stock. Send the engine code, VIN or vehicle details."],
  ["We check Dubai availability", "If suppliers do not have a match, our team on the ground searches local garages."],
  ["Review and reserve", "Approve the proforma and pay the deposit; then we reserve the available engine for you."],
  ["Ship, deliver and fit", "After it arrives in Zimbabwe, our mechanics can fit or mount it in your vehicle as an optional service."],
];

const TRUST = [
  ["Inspection before export", "Compression test, oil-pressure check and a video walk-around for every unit."],
  ["Duty shown, not hidden", "Duty, VAT, surtax, clearing and inland delivery are itemised before you pay."],
  ["Proof of sourcing", "Supplier, lot and serial number recorded against your line once purchased."],
  ["One desk, two countries", "Dubai sourcing, Zimbabwe delivery and local engine-fitting support."],
];

export default function Home() {
  const { site, companyName } = useAuth();
  const [activeSlide, setActiveSlide] = useState(0);
  const [rotationPaused, setRotationPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [featured, setFeatured] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState("");
  const [example, setExample] = useState(null);
  const [exampleEstimate, setExampleEstimate] = useState(null);
  const [exampleLoading, setExampleLoading] = useState(true);
  const [exampleError, setExampleError] = useState("");
  const [leadRange, setLeadRange] = useState(null);

  useEffect(() => {
    if (
      rotationPaused ||
      interactionPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % HERO_SLIDES.length);
    }, 7000);
    return () => window.clearInterval(intervalId);
  }, [interactionPaused, rotationPaused]);

  useEffect(() => {
    const nextSlide = HERO_SLIDES[(activeSlide + 1) % HERO_SLIDES.length];
    const nextImage = new Image();
    nextImage.src = nextSlide.image;
  }, [activeSlide]);

  useEffect(() => {
    let active = true;
    api("/engines?sort=featured")
      .then(async (res) => {
        if (!active) return;
        const available = res.engines.filter((engine) => engine.sourcing_available);
        setFeatured(available.slice(0, 3));
        const leadDays = available.map((engine) => Number(engine.typical_lead_days)).filter(Number.isFinite);
        if (leadDays.length) setLeadRange([Math.min(...leadDays), Math.max(...leadDays)]);
        setFeaturedLoading(false);
        const sample = available.find((engine) => engine.model_code === "1HZ") || available[0];
        setExample(sample || null);
        if (!sample) {
          setExampleLoading(false);
          return;
        }
        try {
          const estimate = await api("/quote-estimate", {
            method: "POST",
            body: { goods_total: sample.guide_price_usd },
          });
          if (active) setExampleEstimate(estimate.estimate);
        } catch (err) {
          if (active) setExampleError(err.message);
        }
      })
      .catch((err) => {
        if (active) {
          setFeaturedError(err.message);
          setExampleError(err.message);
        }
      })
      .finally(() => {
        if (active) {
          setFeaturedLoading(false);
          setExampleLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const slide = HERO_SLIDES[activeSlide];
  const previousSlide = () => {
    setActiveSlide((current) => (current + HERO_SLIDES.length - 1) % HERO_SLIDES.length);
  };
  const nextSlide = () => {
    setActiveSlide((current) => (current + 1) % HERO_SLIDES.length);
  };

  return (
    <>
      <section
        className="home-hero"
        aria-label={`${companyName} engine sourcing highlights`}
        aria-roledescription="carousel"
        onMouseEnter={() => setInteractionPaused(true)}
        onMouseLeave={() => setInteractionPaused(false)}
        onFocusCapture={() => setInteractionPaused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setInteractionPaused(false);
          }
        }}
      >
        <div className="home-hero__background" key={slide.image} aria-hidden="true">
          <img src={slide.image} alt="" decoding="async" />
        </div>
        <div className="home-hero__inner container">
          <div className="home-hero__layout">
            <div
              className="home-hero__copy"
              key={activeSlide}
              aria-live={rotationPaused || interactionPaused ? "polite" : "off"}
            >
              <p className="home-hero__eyebrow">
                <span className="home-hero__status-dot" aria-hidden="true" />
                {slide.eyebrow}
              </p>
              <h1>
                <span>{slide.title}</span>
                <span className="home-hero__accent">{slide.accent}</span>
              </h1>
              <p className="home-hero__description">{slide.description}</p>
              <div className="home-hero__actions">
                <Link className="btn accent large" to="/engines">
                  Browse engine types
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M3.5 10h12m-5-5 5 5-5 5" />
                  </svg>
                </Link>
                <Link className="btn large home-hero__secondary" to="/checkout">
                  Request an engine
                </Link>
              </div>
              <p className="home-hero__promise">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="m4 10 4 4 8-8" />
                </svg>
                No stock held · availability confirmed per request
              </p>
            </div>

            <aside className="home-route-card" aria-label="How our engine sourcing works">
              <div className="home-route-card__top">
                <span className="home-route-card__icon" aria-hidden="true">
                  <svg viewBox="0 0 32 32" fill="none">
                    <path d="M5 18h3l3-6h10l4 4h3v8h-3a4 4 0 0 1-8 0h-4a4 4 0 0 1-8 0v-6Z" />
                    <path d="M11 12V8h9l4 8M12 8V5h6v3" />
                    <circle cx="11" cy="24" r="2" />
                    <circle cx="21" cy="24" r="2" />
                  </svg>
                </span>
                <div>
                  <span className="home-route-card__label">Your sourcing journey</span>
                  <span className="home-route-card__sub">Dubai to Zimbabwe</span>
                </div>
                <span className="home-route-card__badge">
                  <span aria-hidden="true" />
                  On request
                </span>
              </div>
              <h2>No stock. A clear path forward.</h2>
              <ol className="home-route-card__steps">
                {ROUTE_STEPS.map(([number, title, detail]) => (
                  <li key={number}>
                    <span className="home-route-card__number">{number}</span>
                    <span className="home-route-card__step-copy">
                      <strong>{title}</strong>
                      <small>{detail}</small>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="home-route-card__note">
                Illustrative photo only · each engine is sourced for your request.
              </p>
            </aside>
          </div>

          <div className="home-hero__footer">
            <p className="home-hero__credit">
              <span>Illustrative photo · </span>
              <a href={slide.imageSource} target="_blank" rel="noreferrer">
                {slide.imageCredit} / Wikimedia Commons
              </a>
              <span> · </span>
              <a href={slide.imageLicenseUrl} target="_blank" rel="noreferrer">
                {slide.imageLicense}
              </a>
            </p>
            <div className="home-hero__controls" role="group" aria-label="Hero slide controls">
              <span className="home-hero__count" aria-live="off">
                {String(activeSlide + 1).padStart(2, "0")}
                <span> / </span>
                {String(HERO_SLIDES.length).padStart(2, "0")}
              </span>
              <div className="home-hero__dots" role="group" aria-label="Choose a slide">
                {HERO_SLIDES.map((item, index) => (
                  <button
                    className={index === activeSlide ? "active" : ""}
                    key={item.eyebrow}
                    type="button"
                    aria-label={`Show slide ${index + 1}: ${item.title} ${item.accent}`}
                    aria-current={index === activeSlide ? "true" : undefined}
                    onClick={() => setActiveSlide(index)}
                  />
                ))}
              </div>
              <button
                className="home-hero__control"
                type="button"
                aria-label="Show previous slide"
                onClick={previousSlide}
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M16.5 10h-12m5 5-5-5 5-5" />
                </svg>
              </button>
              <button
                className="home-hero__control"
                type="button"
                aria-label="Show next slide"
                onClick={nextSlide}
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M3.5 10h12m-5-5 5 5-5 5" />
                </svg>
              </button>
              <button
                className="home-hero__control home-hero__toggle"
                type="button"
                aria-label={rotationPaused ? "Resume automatic slide rotation" : "Pause automatic slide rotation"}
                aria-pressed={rotationPaused}
                onClick={() => setRotationPaused((paused) => !paused)}
              >
                {rotationPaused ? (
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="m7 4 9 6-9 6V4Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M7 5v10m6-10v10" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="home-tools-band" id="home-tools">
        <div className="container">
          <div className="home-tools-grid">
            <div className="home-finder-panel">
              <div className="home-finder-panel__heading">
                <p className="eyebrow">Start with what you know</p>
                <h2>Tell us what you&apos;re driving.</h2>
                <p>Search by vehicle, make or engine code. Not sure? Send us what you have.</p>
              </div>
              <EngineFinder />
            </div>

            <aside className="home-estimate-card" aria-live="polite">
              <div className="home-estimate-card__heading">
                <p className="home-estimate-card__eyebrow">Before you commit</p>
                <h2>Know the full landed cost.</h2>
              </div>
              {exampleLoading ? (
                <LoadingState compact label="Building a landed-cost example…" />
              ) : example ? (
                <>
                  <div className="home-estimate-card__engine">
                    <span>Illustrative estimate for</span>
                    <strong>{example.title}</strong>
                    <small>
                      {example.displacement_cc
                        ? `${example.displacement_cc.toLocaleString()} cc`
                        : example.model_code}{" "}
                      · {example.fuel}
                    </small>
                  </div>
                  {exampleEstimate ? (
                    <>
                      <ul className="home-estimate-card__rows">
                        <li><span>Engine guide</span><strong>{money(exampleEstimate.goods_total)}</strong></li>
                        <li><span>Freight + insurance</span><strong>{money(exampleEstimate.freight + exampleEstimate.insurance)}</strong></li>
                        <li><span>Duty, VAT + surtax</span><strong>{money(exampleEstimate.duty + exampleEstimate.vat + exampleEstimate.surtax)}</strong></li>
                        <li><span>Clearing + inland</span><strong>{money(exampleEstimate.clearing + exampleEstimate.inland)}</strong></li>
                        <li className="total"><span>Indicative total</span><strong>{money(exampleEstimate.total)}</strong></li>
                      </ul>
                      <div className="home-estimate-card__footer">
                        <span>USD · final price confirmed in your proforma</span>
                        <Link to="/calculator" aria-label="Adjust the landed-cost estimate">
                          Adjust
                          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="M3.5 10h12m-5-5 5 5-5 5" />
                          </svg>
                        </Link>
                      </div>
                    </>
                  ) : (
                    <p className="home-estimate-card__error" role="status">
                      {exampleError || "The landed-cost example is temporarily unavailable."}
                    </p>
                  )}
                </>
              ) : (
                <div className="home-estimate-card__empty">
                  <p>Share the engine code or vehicle and we&apos;ll check availability.</p>
                  <Link className="btn accent" to="/checkout">Request a quote</Link>
                </div>
              )}
            </aside>
          </div>

          <div className="metrics home-metrics">
            <div><strong>On request</strong><span>No engines held in stock</span></div>
            <div>
              <strong>{leadRange ? `${leadRange[0]}–${leadRange[1]}d` : "Confirmed"}</strong>
              <span>Estimated lead time</span>
            </div>
            <div><strong>USD</strong><span>Clear quote currency</span></div>
            <div><strong>Before deposit</strong><span>Full landed cost shown</span></div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="editorial">
          <div>
            <p className="eyebrow">Why we exist</p>
            <h2>
              Engines are the
              <br />
              <span className="serif">hard part</span> of importing.
            </h2>
          </div>
          <div className="editorial-body">
            <p>
              A vehicle can be inspected. An engine cannot — not from a photograph, not from a
              listing, not after it has crossed an ocean. Most importers sell you a price and hope
              the unit matches it. We do the opposite: the unit is found, tested and recorded in
              Dubai first, then quoted with every cost that follows it.
            </p>
            <p>
              That means the figure you agree to is the figure you pay. Freight, ZIMRA duty, VAT,
              surtax, clearing agent and inland delivery are itemised line by line. If a unit is
              not inspectable, it does not enter the catalogue.
            </p>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div>
            <p className="eyebrow">The process</p>
            <h2>Four steps to a landed engine</h2>
          </div>
          <span className="meta">No stock held · nothing to clear</span>
        </div>
        <div className="process">
          {STEPS.map(([title, body], i) => (
            <div className="process-step" key={title}>
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {featuredLoading ? (
        <section className="container section">
          <LoadingState compact label="Loading featured engines…" />
        </section>
      ) : featuredError ? (
        <section className="container section">
          <p className="alert" role="status">{featuredError}</p>
        </section>
      ) : featured.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Most requested</p>
              <h2>Engine types we source</h2>
            </div>
            <Link className="textlink" to="/engines">All engine types</Link>
          </div>
          <div className="engine-grid">
            {featured.map((e) => (
              <Link className="engine-card" key={e.id} to={`/engines/${e.id}`}>
                {e.image_url && (
                  <img
                    className="engine-card-photo"
                    src={e.image_url}
                    alt={`${e.title} example photo`}
                    loading="lazy"
                  />
                )}
                <div className="engine-card-top">
                  <span className="engine-code">{e.make} · {e.model_code}</span>
                  <span className="pill ok">{e.warranty_days || 90}d warranty</span>
                </div>
                <h3>{e.title}</h3>
                <p className="engine-spec">
                  {e.displacement_cc?.toLocaleString()} cc · {e.fuel} · {e.cylinders || "—"} cyl
                </p>
                <p className="engine-desc">{e.description}</p>
                <div className="engine-bottom">
                  <div className="engine-price">
                    <span className="label">Supplier guide</span>
                    <strong>{money(e.guide_price_usd)}</strong>
                  </div>
                  <span className="engine-arrow">↗</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container section">
        <div className="section-head">
          <div>
            <p className="eyebrow">What you get</p>
            <h2>Proof, not promises</h2>
          </div>
          <span className="meta">{site?.warranty_summary ? "90-day start-up warranty" : ""}</span>
        </div>
        <div className="trust-grid">
          {TRUST.map(([title, body]) => (
            <div className="trust-item" key={title}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3Z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="closing">
          <div>
            <p className="eyebrow" style={{ color: "#8f8a7e" }}>Ready to start</p>
            <h2>Send us the engine. We&apos;ll price it landed.</h2>
            <p>
              No payment until you have seen the proforma. If suppliers do not have the engine, our
              Dubai team searches local garages and shares a quote when a suitable match is found.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
            <Link className="btn large" to="/checkout">Request a quote</Link>
            {site?.whatsapp_link && (
              <a className="btn large" href={site.whatsapp_link} target="_blank" rel="noreferrer">
                WhatsApp us
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
