// Static screens only: the hash (#/bugete) picks the screen. No data loading or business logic yet.

import { useEffect, useState } from "react";

import { FlowFrame, SectionFrame } from "./components/layout.jsx";
import { client } from "./data/demo.js";
import Budgets from "./screens/Budgets.jsx";
import Chat from "./screens/Chat.jsx";
import Goals from "./screens/Goals.jsx";
import Profile from "./screens/Profile.jsx";
import Summary from "./screens/Summary.jsx";

// Pages of the Coach tab. The chat opens full screen, like a payment flow in the app.
const SECTION_SCREENS = { rezumat: Summary, bugete: Budgets, obiective: Goals, profil: Profile };

function routeFromHash() {
  const key = window.location.hash.replace(/^#\/?/, "");
  if (key === "chat") return key;
  return key in SECTION_SCREENS ? key : "rezumat";
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

  if (route === "chat") {
    return (
      <FlowFrame title="Coach" closeHref="#/rezumat">
        <Chat />
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
