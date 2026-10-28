package ro.greenstruct.agro.bedrock;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

import ro.greenstruct.agro.api.BedrockHealthProbe;
import ro.greenstruct.agro.orchestration.Agent;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.technical.DocumentExtractor;

import static org.assertj.core.api.Assertions.assertThat;

/** The app starts without Bedrock credentials, with the three agents in REPLAY and no Bedrock beans. */
@SpringBootTest(properties = {"greenstruct.agent-runtime.enabled=true", "greenstruct.bedrock.enabled=false",
        "greenstruct.mode=HYBRID"})
class AgentWiringTest {

    @Autowired
    List<Agent> agents;

    @Autowired
    AgentRuntime runtime;

    @Autowired
    DocumentExtractor extractor;

    @Autowired
    ApplicationContext context;

    @Test
    void threeAgentsOneForEachSlot() {
        assertThat(agents).extracting(Agent::slot).containsExactlyInAnyOrder(AgentSlot.values());
    }

    @Test
    void withoutCredentialsTheAgentsReplayAndNoBedrockBeanExists() {
        assertThat(runtime.mode()).isEqualTo(AgentModes.Mode.REPLAY);
        assertThat(context.getBeansOfType(BedrockGateway.class)).isEmpty();
        assertThat(context.getBeansOfType(BedrockHealthProbe.class)).isEmpty();
        assertThat(extractor).isInstanceOf(ReplayAwareDocumentExtractor.class);
        assertThat(agents.getFirst().modelId()).contains("replay");
    }

    @Test
    void thePromptsAndSchemasOfEverySlotLoad() {
        SchemaSupport schemas = context.getBean(SchemaSupport.class);
        for (AgentSlot slot : AgentSlot.values()) {
            assertThat(AgentRuntimeConfiguration.prompt(slot.name().toLowerCase())).contains(slot.submitTool());
            assertThat(schemas.forBedrock(slot.submitTool()).path("type").asText()).isEqualTo("object");
        }
        assertThat(AgentRuntimeConfiguration.prompt("extraction")).contains("submit_offer_extraction");
    }
}
