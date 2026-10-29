// The hash (#/bugete) picks the screen. The personal Busola screens are static; the green-credit flow (#/verde/...) and the
// officer zone (#/ofiter/...) talk to the GreenStruct backend (src/lib/api.js).
// The demo starts at a simulated sign-in. Each personal account opens the same optional Coach in Produse
// with its own client's data (Daria, salary; Matei, student); the business account opens the green credit
// for investments, agriculture first (design/pj-greenstruct.md).

import { useEffect, useState } from "react";

import { BareFrame, FlowActions, FlowFrame, ProductsFrame, SectionFrame } from "./components/layout.jsx";
import { RoleSwitch } from "./components/live.jsx";
import { DisclaimerStrip } from "./components/ui.jsx";
import { business } from "./data/accounts.js";
import { greenLegal } from "./data/green/legal.js";
import { greenPacks } from "./data/green/packs.js";
import { personas } from "./data/personas.js";
import { PersonaContext, storePersonaId, storedPersonaId, usePersona } from "./persona.js";
import { ACTIVATION_STEPS, activationRoutes } from "./screens/activation/routes.js";
import { Statements } from "./screens/activation/Statements.jsx";
import Budgets from "./screens/Budgets.jsx";
import Business from "./screens/Business.jsx";
import Chat from "./screens/Chat.jsx";
import Goals from "./screens/Goals.jsx";
import { GREEN_STEPS, greenRoutes } from "./screens/green/routes.js";
import { Sectors } from "./screens/green/Sectors.jsx";
import Ideas from "./screens/Ideas.jsx";
import Legal from "./screens/Legal.jsx";
import Login from "./screens/Login.jsx";
import { OfficerDossier } from "./screens/officer/Dossier.jsx";
import { OfficerHome } from "./screens/officer/Home.jsx";
import Products from "./screens/Products.jsx";
import Profile from "./screens/Profile.jsx";
import Summary from "./screens/Summary.jsx";
import Tracking from "./screens/Tracking.jsx";
import TransactionDetail from "./screens/TransactionDetail.jsx";

// Pages of the Coach; each client sees the ones in its `pages`. The chat, a payment's details,
// the statements and the notice open full screen.
const SECTION_SCREENS = { rezumat: Summary, cheltuieli: Tracking, bugete: Budgets, obiective: Goals, idei: Ideas, profil: Profile };
const OTHER_ROUTES = ["login", "login/pj", "produse", "firma", "chat", "extrase", "informare", "verde", "verde/informare"];
const PAYMENT_PREFIX = "cheltuieli/";
const ACTIVATION_PREFIX = "activare";
// #/verde/<area>/<step>: the green-credit flow of one area of the platform.
const GREEN_PREFIX = "verde/";
// #/ofiter and #/ofiter/dosar/<runId>: the bank officer's zone (README §8), wider than the phone column.
const OFFICER_PREFIX = "ofiter";
const OFFICER_DOSSIER = "ofiter/dosar/";
// #/intra/<id> signs in as that demo client, then opens Produse.
const ENTRY_PREFIX = "intra/";

function hashKey() {
  return window.location.hash.replace(/^#\/?/, "").replace(/\/$/, "");
}

function routeFromHash() {
  const key = hashKey();
  if (OTHER_ROUTES.includes(key) || key in SECTION_SCREENS || key.startsWith(ACTIVATION_PREFIX) || key.startsWith(PAYMENT_PREFIX) || key.startsWith(GREEN_PREFIX) || key === OFFICER_PREFIX || key.startsWith(OFFICER_DOSSIER)) return key;
  return "login";
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [personaId, setPersonaId] = useState(storedPersonaId);

  useEffect(() => {
    const onHashChange = () => {
      const key = hashKey();
      if (key.startsWith(ENTRY_PREFIX)) {
        const id = key.slice(ENTRY_PREFIX.length);
        if (id in personas) {
          setPersonaId(id);
          storePersonaId(id);
        }
        window.location.replace("#/produse");
        return;
      }
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <PersonaContext.Provider value={personas[personaId]}>
      <Screens route={route} />
    </PersonaContext.Provider>
  );
}

function Screens({ route }) {
  const persona = usePersona();

  if (route === "login" || route === "login/pj") {
    return (
      <BareFrame key={route}>
        <Login type={route === "login" ? "pf" : "pj"} />
      </BareFrame>
    );
  }

  if (route === OFFICER_PREFIX) return <OfficerHome />;
  if (route.startsWith(OFFICER_DOSSIER)) return <OfficerDossier key={route} runId={route.slice(OFFICER_DOSSIER.length)} />;

  if (route === "produse") {
    return (
      <ProductsFrame subtitle={`${persona.client.name} · ${persona.client.segment}`}>
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
      <FlowFrame title="Account statements" titleAs="p" closeHref="#/profil" footer={<FlowActions next="#/profil" nextLabel="Done" />}>
        <Statements />
      </FlowFrame>
    );
  }

  if (route.startsWith(PAYMENT_PREFIX)) {
    return (
      <FlowFrame
        key={route}
        title="Transaction details"
        titleAs="p"
        backHref="#/cheltuieli"
        closeHref="#/cheltuieli"
        footer={<FlowActions next="#/cheltuieli" nextLabel="Save" skip="#/cheltuieli" skipLabel="Cancel" />}
      >
        <TransactionDetail id={route.slice(PAYMENT_PREFIX.length)} />
      </FlowFrame>
    );
  }

  if (route === "informare") {
    return (
      <FlowFrame title="Notice" closeHref="#/rezumat">
        <Legal />
      </FlowFrame>
    );
  }

  if (route === "verde/informare") {
    return (
      <FlowFrame title="Notice" closeHref="#/verde">
        <Legal legal={greenLegal} />
      </FlowFrame>
    );
  }

  if (route === "verde" || route.startsWith(GREEN_PREFIX)) {
    const sector = route.split("/")[1];
    const steps = sector in greenPacks ? greenRoutes(sector) : {};
    const strip = <DisclaimerStrip legal={greenLegal} href="#/verde/informare" className="disclaimer-strip--card" />;
    // The area picker, also for an area that is not available yet.
    if (!(route in steps)) {
      return (
        <FlowFrame title="Sustainable credit" titleAs="p" backHref="#/firma" closeHref="#/firma" footer={strip}>
          <Sectors />
        </FlowFrame>
      );
    }
    const { Screen, back, step, footer, actions, title = "Sustainable credit" } = steps[route];
    return (
      <FlowFrame
        key={route}
        title={title}
        titleAs="p"
        closeHref="#/firma"
        backHref={back}
        progress={step ? { steps: GREEN_STEPS, current: step } : null}
        footer={
          <>
            {strip}
            {actions ? <div id="green-actions" className="flow-actions" /> : <FlowActions {...footer} />}
          </>
        }
      >
        <RoleSwitch role="imm" />
        <Screen pack={greenPacks[sector]} />
      </FlowFrame>
    );
  }

  if (route.startsWith(ACTIVATION_PREFIX)) {
    const activation = activationRoutes(persona.questions);
    const key = route in activation ? route : ACTIVATION_PREFIX;
    const { Screen, props, back, step, note, footer } = activation[key];
    return (
      <FlowFrame
        key={key}
        title="Financial coach"
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

  const section = persona.pages.includes(route) ? route : "rezumat";
  const Screen = SECTION_SCREENS[section];
  return (
    <SectionFrame current={section} client={persona.client} pages={persona.pages}>
      <Screen />
    </SectionFrame>
  );
}
