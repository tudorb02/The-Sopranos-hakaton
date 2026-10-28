// Static screens only: the hash (#/bugete) picks the screen. No data loading or business logic yet.
// The Coach is an optional feature: it is offered in Produse and activated in its own flow.

import { useEffect, useState } from "react";

import { FlowActions, FlowFrame, ProductsFrame, SectionFrame } from "./components/layout.jsx";
import { client } from "./data/demo.js";
import { ACTIVATION, ACTIVATION_STEPS } from "./screens/activation/routes.js";
import { Statements } from "./screens/activation/Statements.jsx";
import Budgets from "./screens/Budgets.jsx";
import Chat from "./screens/Chat.jsx";
import Goals from "./screens/Goals.jsx";
import Products from "./screens/Products.jsx";
import Profile from "./screens/Profile.jsx";
import Summary from "./screens/Summary.jsx";

// Pages of the Coach. The chat and the statements open full screen, like a payment flow in the app.
const SECTION_SCREENS = { rezumat: Summary, bugete: Budgets, obiective: Goals, profil: Profile };
const OTHER_ROUTES = ["produse", "chat", "extrase"];

function routeFromHash() {
  const key = window.location.hash.replace(/^#\/?/, "");
  if (OTHER_ROUTES.includes(key) || key in SECTION_SCREENS || key in ACTIVATION) return key;
  return "produse";
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

  if (route === "produse") {
    return (
      <ProductsFrame>
        <Products />
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
