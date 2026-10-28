package ro.greenstruct.agro.bedrock;

import java.util.ArrayList;
import java.util.List;

import ro.greenstruct.agro.api.BedrockHealthProbe;

/** One tiny Converse "ping" per configured model, with the latency; used by GET /api/health/bedrock. */
public class BedrockModelHealthProbe implements BedrockHealthProbe {

    private final BedrockGateway gateway;
    private final BedrockModels models;

    public BedrockModelHealthProbe(BedrockGateway gateway, BedrockModels models) {
        this.gateway = gateway;
        this.models = models;
    }

    @Override
    public List<ModelStatus> probe() {
        List<ModelStatus> statuses = new ArrayList<>();
        statuses.add(ping("AGENT", models.agent()));
        statuses.add(ping("EXTRACTION", models.extraction()));
        if (!models.fallback().equals(models.extraction()) && !models.fallback().equals(models.agent())) {
            statuses.add(ping("FALLBACK", models.fallback()));
        }
        return statuses;
    }

    private ModelStatus ping(String role, String modelId) {
        long started = System.nanoTime();
        try {
            gateway.converse(new BedrockGateway.Request(modelId, null,
                    List.of(BedrockGateway.Message.user(new BedrockGateway.Text("ping"))), List.of(), null, 8));
            return new ModelStatus(role, modelId, true, (System.nanoTime() - started) / 1_000_000, null);
        } catch (BedrockCallException e) {
            return new ModelStatus(role, modelId, false, null, switch (e.kind()) {
                case THROTTLED -> "Modelul e limitat temporar (throttling)";
                case TIMEOUT -> "Modelul nu a răspuns la timp";
                case NO_NETWORK -> "Fără conexiune la AWS";
                case UNAVAILABLE -> "Serviciul Bedrock e indisponibil";
                case REJECTED -> "Cererea a fost respinsă: " + e.getMessage();
            });
        }
    }
}
