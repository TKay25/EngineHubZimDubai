import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Brand from "./components/Brand";
import ChatWidget from "./components/ChatWidget";
import Modal from "./components/Modal";
import { useAuth } from "./lib/auth";
import { useCart } from "./lib/cart";
import { LoadingButton, LoadingState } from "./components/Loading";
import Home from "./pages/Home";
import Catalog from "./pages/Catalog";
import EngineDetail from "./pages/EngineDetail";
import Calculator from "./pages/Calculator";
import Checkout from "./pages/Checkout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Account from "./pages/Account";
import OrderDetail from "./pages/OrderDetail";
import Admin from "./pages/Admin";

function Header() {
  const { user, logout, loading } = useAuth();
  const { count } = useCart();
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation || location;
  const [scrolled, setScrolled] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setMenuOpen(false);
  }, [location.pathname]);

  async function signOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      await logout();
    } catch (error) {
      setSignOutError(error.message);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
      <div className="container header-inner">
        <Brand />
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
          <span className={`menu-icon${menuOpen ? " open" : ""}`} aria-hidden="true">
            <i /><i /><i />
          </span>
        </button>
        <nav id="primary-navigation" className={`nav${menuOpen ? " open" : ""}`} aria-label="Main">
          <NavLink to="/engines">Engines</NavLink>
          <NavLink to="/calculator">Landed cost</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
          {user && <NavLink to="/account">My orders</NavLink>}
          {user?.is_admin && <NavLink to="/admin">Admin</NavLink>}
          <Link className="nav-request" to="/checkout">
            Request{count > 0 && <span className="badge">{count}</span>}
          </Link>
          <div className="nav-auth">
            {user ? (
              <LoadingButton className="btn small" onClick={signOut} loading={signingOut} loadingLabel="Signing out…">
                Sign out
              </LoadingButton>
            ) : (
              <>
                <Link className="btn quiet small" to="/login" state={{ backgroundLocation }}>Sign in</Link>
                <Link className="btn small" to="/register" state={{ backgroundLocation }}>Create account</Link>
              </>
            )}
          </div>
        </nav>
        <div className="header-actions">
          {loading ? (
            <LoadingState compact label="Checking account…" />
          ) : user ? (
            <>
              <span className="greeting">{user.name.split(" ")[0]}</span>
              <LoadingButton className="btn small" onClick={signOut} loading={signingOut} loadingLabel="Signing out…">
                Sign out
              </LoadingButton>
            </>
          ) : (
            <>
              <Link className="btn quiet small" to="/login" state={{ backgroundLocation }}>Sign in</Link>
              <Link className="btn small" to="/register" state={{ backgroundLocation }}>Create account</Link>
            </>
          )}
        </div>
        {signOutError && <span className="small" role="alert">{signOutError}</span>}
      </div>
    </header>
  );
}

function Footer() {
  const { site, companyName } = useAuth();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <img src="/static/brand/logo.svg" alt={companyName} />
            </div>
            <p className="footer-note">
              {site?.tagline || "Engines sourced from Dubai, delivered across Zimbabwe."}
            </p>
            {site?.registration_number && (
              <p className="mono" style={{ fontSize: "0.72rem", letterSpacing: "0.04em", marginTop: "1rem" }}>
                Reg. {site.registration_number}
              </p>
            )}
          </div>
          <div>
            <h4>Sourcing desk</h4>
            <p>{site?.address || "Dubai, UAE"}</p>
            <p>Harare, Zimbabwe</p>
            <p>{site?.office_hours}</p>
          </div>
          <div>
            <h4>Talk to us</h4>
            <p>{site?.phone}</p>
            <p>{site?.email}</p>
            {site?.whatsapp_link && (
              <p><a href={site.whatsapp_link} target="_blank" rel="noreferrer">WhatsApp</a></p>
            )}
          </div>
        </div>
        <div className="copyright">
          <span>© {new Date().getFullYear()} {companyName}. Prices in USD.</span>
          <span>Pre-order only · No stock held</span>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;
  const navigate = useNavigate();
  const closeAuthModal = useCallback(() => navigate(-1), [navigate]);

  return (
    <div className="app-shell">
      <Header />
      <main>
        <Routes location={backgroundLocation || location}>
          <Route path="/" element={<Home />} />
          <Route path="/engines" element={<Catalog />} />
          <Route path="/engines/:id" element={<EngineDetail />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/how-it-works" element={<Home scrollTo="process" />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account" element={<Account />} />
          <Route path="/orders/:reference" element={<OrderDetail />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Home />} />
        </Routes>
        {backgroundLocation && (
          <Routes>
            <Route
              path="/login"
              element={<Modal title="Sign in" onClose={closeAuthModal} className="auth-dialog"><Login /></Modal>}
            />
            <Route
              path="/register"
              element={<Modal title="Create an account" onClose={closeAuthModal} className="auth-dialog"><Register /></Modal>}
            />
          </Routes>
        )}
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
