import { ActivityIndicator, View } from "react-native";
import { Btn, CardTitle, Small } from "./base.jsx";
import { color, space } from "../theme.js";
import { usePersonaApi } from "../persona.js";

export function ApiState({ loading, error, retry }) {
  return (
    <View accessibilityRole={error ? "alert" : undefined} accessibilityLiveRegion="polite" style={{ gap: space.md, alignItems: "flex-start", paddingVertical: space.lg }}>
      {loading ? <ActivityIndicator color={color.teal} accessibilityLabel="Se încarcă datele" /> : null}
      <CardTitle>{loading ? "Încarc datele tale…" : "Datele nu sunt disponibile"}</CardTitle>
      {error ? <Small>{error.message}</Small> : <Small muted>Pregătesc informațiile pentru acest ecran.</Small>}
      {error && retry ? <Btn onPress={retry} variant="outline">Încearcă din nou</Btn> : null}
    </View>
  );
}

export function SaveNotice() {
  const api = usePersonaApi();
  const error = api?.error ?? api?.loadError;
  if (!error && !api?.busy) return null;
  return <View style={{ gap: space.xs }}><Small accessibilityRole={error ? "alert" : undefined} accessibilityLiveRegion="polite" style={error ? { color: color.danger } : undefined}>{error?.message ?? "Salvez modificările…"}</Small>
    {error ? <Btn small variant="text" onPress={async () => { if (await api.reload()) api.reportError(null); }}>Reîncarcă datele</Btn> : null}</View>;
}
