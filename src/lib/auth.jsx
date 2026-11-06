import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { withLocalMechanicFitting } from "./siteCopy";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSite = useCallback(async () => {
    try {
      const res = await api("/site");
      setSite(res.site);
      return res.site;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api("/auth/me"), api("/site")])
      .then(([me, info]) => {
        if (!alive) return;
        setUser(me.user);
        setSite(info.site);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!site?.company_name) return;
    document.title = `${site.company_name} — ${withLocalMechanicFitting(site.tagline)}`;
  }, [site]);

  const value = useMemo(
    () => ({
      user,
      site,
      loading,
      companyName: site?.company_name || "ZimOsaka AutoSpares",
      async login(email, password) {
        const res = await api("/auth/login", { method: "POST", body: { email, password } });
        setUser(res.user);
        return res.user;
      },
      async register(payload) {
        const res = await api("/auth/register", { method: "POST", body: payload });
        setUser(res.user);
        return res.user;
      },
      async logout() {
        await api("/auth/logout", { method: "POST" });
        setUser(null);
      },
      async refresh() {
        const res = await api("/auth/me");
        setUser(res.user);
        return res.user;
      },
      async updateProfile(payload) {
        const res = await api("/auth/profile", { method: "PATCH", body: payload });
        setUser(res.user);
        return res.user;
      },
      loadSite,
    }),
    [user, site, loading, loadSite]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
