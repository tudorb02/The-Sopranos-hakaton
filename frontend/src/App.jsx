// Personal routes load their data from the isolated demo API through PersonaProvider.
// The demo starts at a simulated sign-in. Each personal account opens the same optional Coach in Produse
// with its own client's data (Daria, salary; Matei, student); the business account opens the green credit
// for investments, agriculture first (design/pj-greenstruct.md).

import { HankenGrotesk_400Regular } from "@expo-google-fonts/hanken-grotesk/400Regular";
import { HankenGrotesk_500Medium } from "@expo-google-fonts/hanken-grotesk/500Medium";
import { HankenGrotesk_600SemiBold } from "@expo-google-fonts/hanken-grotesk/600SemiBold";
import { HankenGrotesk_700Bold } from "@expo-google-fonts/hanken-grotesk/700Bold";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BareFrame, FlowActions, FlowFrame, ProductsFrame, SectionFrame } from "./components/layout.jsx";
import { DisclaimerStrip } from "./components/ui.jsx";
import { ApiState, SaveNotice } from "./components/ApiState.jsx";
import { PersonaProvider } from "./components/PersonaProvider.jsx";
import { business } from "./data/accounts.js";
import { greenLegal } from "./data/green/legal.js";
import { greenPacks } from "./data/green/packs.js";
import { PERSONA_IDS, storePersonaId, storedPersonaId, usePersona, usePersonaApi } from "./persona.js";
import { RouterProvider, useRouter } from "./router.jsx";
import { ACTIVATION_STEPS, activationRoutes } from "./screens/activation/routes.js";
import { Statements } from "./screens/activation/Statements.jsx";
import Budgets from "./screens/Budgets.jsx";
import Business from "./screens/Business.jsx";
import Chat, { Composer } from "./screens/Chat.jsx";
import Goals from "./screens/Goals.jsx";
import { GREEN_STEPS, greenRoutes } from "./screens/green/routes.js";
import { Sectors } from "./screens/green/Sectors.jsx";
import Ideas from "./screens/Ideas.jsx";
import Legal from "./screens/Legal.jsx";
import Login from "./screens/Login.jsx";
import Products from "./screens/Products.jsx";
import Profile from "./screens/Profile.jsx";
import Summary from "./screens/Summary.jsx";
import Tracking from "./screens/Tracking.jsx";
import TransactionDetail from "./screens/TransactionDetail.jsx";
import { color } from "./theme.js";

// Pages of the Coach; each client sees the ones in its `pages`. The chat, a payment's details,
// the statements and the notice open full screen.
const SECTION_SCREENS = { rezumat: Summary, cheltuieli: Tracking, bugete: Budgets, obiective: Goals, idei: Ideas, profil: Profile };
const OTHER_ROUTES = ["login", "login/pj", "produse", "firma", "chat", "extrase", "informare", "verde", "verde/informare"];
const PAYMENT_PREFIX = "cheltuieli/";
const ACTIVATION_PREFIX = "activare";
// verde/<area>/<step>: the green-credit flow of one area of the platform.
const GREEN_PREFIX = "verde/";
// intra/<id> signs in as that demo client, then opens Produse.
const ENTRY_PREFIX = "intra/";

function isRoute(key) {
  return OTHER_ROUTES.includes(key) || key in SECTION_SCREENS || key.startsWith(ACTIVATION_PREFIX) || key.startsWith(PAYMENT_PREFIX) || key.startsWith(GREEN_PREFIX);
}

export default function App() {
  const [fontsLoaded] = useFonts({ HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold });
  const [personaId, setPersonaId] = useState(storedPersonaId);

  const resolve = useCallback((key) => {
    if (key.startsWith(ENTRY_PREFIX)) {
      const id = key.slice(ENTRY_PREFIX.length);
      if (PERSONA_IDS.includes(id)) {
        setPersonaId(id);
        storePersonaId(id);
      }
      return { redirect: "#/produse" };
    }
    return { route: isRoute(key) ? key : "login" };
  }, []);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: color.sand }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RouterProvider resolve={resolve}>
        <PersonaProvider id={personaId}>
          <Screens />
        </PersonaProvider>
      </RouterProvider>
    </SafeAreaProvider>
  );
}

function Screens() {
  const { route } = useRouter();
  const persona = usePersona();
  const api = usePersonaApi();
  const publicRoute = ["login", "login/pj", "firma", "verde"].includes(route) || route.startsWith(GREEN_PREFIX);
  if (!publicRoute && api.status !== "ready") return <BareFrame><ApiState loading={api.status === "loading"} error={api.loadError} retry={api.reload} /></BareFrame>;
  if (!publicRoute && !api.enabled) return <ProductsFrame subtitle={persona?.client?.name}><SaveNotice /><Products /></ProductsFrame>;

  if (route === "login" || route === "login/pj") {
    return (
      <BareFrame>
        <Login type={route === "login" ? "pf" : "pj"} />
      </BareFrame>
    );
  }

  if (route === "produse") {
    return (
      <ProductsFrame subtitle={`${persona.client.name} · ${persona.client.segment}`}>
        <SaveNotice />
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
      <FlowFrame title="Coach" closeHref="#/rezumat" footer={<Composer />} bare>
        <SaveNotice />
        <Chat />
      </FlowFrame>
    );
  }

  if (route === "extrase") {
    return (
      <FlowFrame title="Extrase de cont" closeHref="#/profil" footer={<FlowActions next="#/profil" nextLabel="Gata" />}>
        <SaveNotice />
        <Statements />
      </FlowFrame>
    );
  }

  if (route.startsWith(PAYMENT_PREFIX)) {
    return (
      <FlowFrame
        title="Detalii tranzacție"
        backHref="#/cheltuieli"
        closeHref="#/cheltuieli"
        footer={<PersonalFooter next="#/cheltuieli" nextLabel="Salvează" skip="#/cheltuieli" skipLabel="Anulează" />}
      >
        <SaveNotice />
        <TransactionDetail key={route} id={route.slice(PAYMENT_PREFIX.length)} />
      </FlowFrame>
    );
  }

  if (route === "informare") {
    return (
      <FlowFrame title="Informare" closeHref="#/rezumat">
        <SaveNotice />
        <Legal />
      </FlowFrame>
    );
  }

  if (route === "verde/informare") {
    return (
      <FlowFrame title="Informare" closeHref="#/verde">
        <Legal legal={greenLegal} />
      </FlowFrame>
    );
  }

  if (route === "verde" || route.startsWith(GREEN_PREFIX)) {
    const sector = route.split("/")[1];
    const steps = sector in greenPacks ? greenRoutes(sector) : {};
    const strip = <DisclaimerStrip legal={greenLegal} href="#/verde/informare" card />;
    // The area picker, also for an area that is not available yet.
    if (!(route in steps)) {
      return (
        <FlowFrame title="Credit verde" backHref="#/firma" closeHref="#/firma" footer={strip}>
          <Sectors />
        </FlowFrame>
      );
    }
    const { Screen, back, step, footer, title = "Credit verde" } = steps[route];
    return (
      <FlowFrame
        title={title}
        closeHref="#/firma"
        backHref={back}
        progress={step ? { steps: GREEN_STEPS, current: step } : null}
        footer={
          <>
            <View style={{ marginBottom: 4 }}>{strip}</View>
            <FlowActions {...footer} />
          </>
        }
      >
        <Screen key={route} pack={greenPacks[sector]} />
      </FlowFrame>
    );
  }

  if (route.startsWith(ACTIVATION_PREFIX)) {
    const activation = activationRoutes(persona.questions);
    const key = route in activation ? route : ACTIVATION_PREFIX;
    const { Screen, props, back, step, note, footer } = activation[key];
    return (
      <FlowFrame
        title="Coach financiar"
        closeHref="#/produse"
        backHref={back}
        progress={step ? { steps: ACTIVATION_STEPS, current: step, note } : null}
        footer={<PersonalFooter {...footer} />}
      >
        <SaveNotice />
        <Screen key={key} {...props} />
      </FlowFrame>
    );
  }

  const section = persona.pages.includes(route) ? route : "rezumat";
  const Screen = SECTION_SCREENS[section];
  return (
    <SectionFrame current={section} client={persona.client} pages={persona.pages}>
      <SaveNotice />
      <Screen />
    </SectionFrame>
  );
}

function PersonalFooter(props) {
  const api = usePersonaApi();
  const { navigate, route } = useRouter();
  const next = async () => {
    const saved = route === "activare" ? await api.mutate("/coach", {}, "POST") : await api.submit();
    if (saved !== false) navigate(props.next);
  };
  return <FlowActions {...props} onNext={next} disabled={api.busy} />;
}
