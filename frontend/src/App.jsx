// Static screens only: the hash (#/bugete) picks the screen. No data loading or business logic yet.
// The demo starts at a simulated sign-in; the personal account offers the optional Coach in Produse,
// the business account shows that its features differ.

import { useEffect, useState } from "react";

import { BareFrame, FlowActions, FlowFrame, ProductsFrame, SectionFrame } from "./components/layout.jsx";
import { accounts, business } from "./data/accounts.js";
import { client } from "./data/demo.js";
import { ACTIVATION, ACTIVATION_STEPS } from "./screens/activation/routes.js";
import { Statements } from "./screens/activation/Statements.jsx";
import Budgets from "./screens/Budgets.jsx";
import Business from "./screens/Business.jsx";
import Chat from "./screens/Chat.jsx";
import Goals from "./screens/Goals.jsx";
import Legal from "./screens/Legal.jsx";
import Login from "./screens/Login.jsx";
import Products from "./screens/Products.jsx";
import Profile from "./screens/Profile.jsx";
import Summary from "./screens/Summary.jsx";
import Tracking from "./screens/Tracking.jsx";
import TransactionDetail from "./screens/TransactionDetail.jsx";

// Pages of the Coach. The chat, a payment's details, the statements and the notice open full screen.
const SECTION_SCREENS = { rezumat: Summary, cheltuieli: Tracking, bugete: Budgets, obiective: Goals, profil: Profile };
const OTHER_ROUTES = ["login", "login/pj", "produse", "firma", "chat", "extrase", "informare"];
const PAYMENT_PREFIX = "cheltuieli/";

function routeFromHash() {
  const key = window.location.hash.replace(/^#\/?/, "");
  if (OTHER_ROUTES.includes(key) || key in SECTION_SCREENS || key in ACTIVATION || key.startsWith(PAYMENT_PREFIX)) return key;
  return "login";
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route === "login" || route === "login/pj") {
    return (
      <BareFrame key={route}>
        <Login type={route === "login" ? "pf" : "pj"} />
      </BareFrame>
    );
  }

  if (route === "produse") {
    return (
      <ProductsFrame subtitle={`${accounts.pf.name} · persoană fizică`}>
        <Products />
      </ProductsFrame>
    );
  }

  if (route === "firma") {
    return (
      <ProductsFrame subtitle={business.subtitle} productsHref="#/firma">
        <Business />
      </ProductsFrame>
    );
  }

  if (route === "chat") {
    return (
      <FlowFrame title="Coach" closeHref="#/rezumat">
        <Chat />
      </FlowFrame>
    );
  }

  if (route === "extrase") {
    return (
      <FlowFrame title="Extrase de cont" titleAs="p" closeHref="#/profil" footer={<FlowActions next="#/profil" nextLabel="Gata" />}>
        <Statements />
      </FlowFrame>
    );
  }

  if (route.startsWith(PAYMENT_PREFIX)) {
    return (
      <FlowFrame
        key={route}
        title="Detalii plată"
        titleAs="p"
        backHref="#/cheltuieli"
        closeHref="#/cheltuieli"
        footer={<FlowActions next="#/cheltuieli" nextLabel="Salvează" skip="#/cheltuieli" skipLabel="Anulează" />}
      >
        <TransactionDetail id={route.slice(PAYMENT_PREFIX.length)} />
      </FlowFrame>
    );
  }

  if (route === "informare") {
    return (
      <FlowFrame title="Informare" closeHref="#/rezumat">
        <Legal />
      </FlowFrame>
    );
  }

  if (route in ACTIVATION) {
    const { Screen, props, back, step, note, footer } = ACTIVATION[route];
    return (
      <FlowFrame
        key={route}
        title="Coach financiar"
        titleAs="p"
        closeHref="#/produse"
        backHref={back}
        progress={step ? { steps: ACTIVATION_STEPS, current: step, note } : null}
        footer={<FlowActions {...footer} />}
      >
        <Screen {...props} />
      </FlowFrame>
    );
  }

  const Screen = SECTION_SCREENS[route];
  return (
    <SectionFrame current={route} client={client}>
      <Screen />
    </SectionFrame>
  );
}
