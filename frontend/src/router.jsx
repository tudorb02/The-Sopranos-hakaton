// Static screens only: a route key ("bugete", "verde/agro/firma") picks the screen. The data keeps the web
// version's links ("#/bugete"), so navigate() takes those as they are. On the web the route also lives in the
// URL hash, so a link can be shared and the browser's back button works; on the phone the routes are kept in a
// stack and Android's back button goes one step back.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BackHandler, Linking, Platform } from "react-native";

const RouterContext = createContext(null);

const isWeb = Platform.OS === "web" && typeof window !== "undefined";

// "#/bugete" -> "bugete"
export const routeKey = (href) => href.replace(/^#?\/?/, "");

const isExternal = (href) => /^[a-z]+:/i.test(href);

// `resolve` turns a key into the route to show, or into another href to go to instead (the sign-in entries).
export function RouterProvider({ resolve, initial = "login", children }) {
  // Empty until the first route is resolved, so an entry link (#/intra/student) never flashes another screen.
  const [stack, setStack] = useState([]);

  const go = useCallback(
    (key, { replace = false } = {}) => {
      let target = resolve(key);
      while (target.redirect) {
        target = resolve(routeKey(target.redirect));
        replace = true;
      }
      if (isWeb) {
        const hash = `#/${target.route}`;
        if (replace) window.history.replaceState(null, "", hash);
        else if (window.location.hash !== hash) window.history.pushState(null, "", hash);
      }
      setStack((current) => (replace ? [...current.slice(0, -1), target.route] : [...current, target.route]));
    },
    [resolve],
  );

  // Normalise the first route (an unknown hash opens the sign-in). It runs in an effect, after the first render,
  // because resolving an entry link (#/intra/student) also picks the demo client in the App above.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    go(isWeb && window.location.hash ? routeKey(window.location.hash) : initial, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isWeb) {
      const onPop = () => {
        const key = routeKey(window.location.hash);
        const target = resolve(key);
        if (target.redirect) return go(routeKey(target.redirect), { replace: true });
        if (target.route !== key) window.history.replaceState(null, "", `#/${target.route}`);
        setStack((current) => [...current.slice(0, -1), target.route]);
      };
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    }
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length < 2) return false;
      setStack(stack.slice(0, -1));
      return true;
    });
    return () => sub.remove();
  }, [go, resolve, stack]);

  const navigate = useCallback(
    (href) => {
      if (isExternal(href)) {
        if (isWeb) window.open(href, "_blank", "noopener,noreferrer");
        else Linking.openURL(href);
        return;
      }
      go(routeKey(href));
    },
    [go],
  );

  const value = useMemo(() => ({ route: stack[stack.length - 1], navigate }), [stack, navigate]);
  if (!stack.length) return null;
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  return useContext(RouterContext);
}
