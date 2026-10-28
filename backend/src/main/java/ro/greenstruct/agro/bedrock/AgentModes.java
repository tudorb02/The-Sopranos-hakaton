package ro.greenstruct.agro.bedrock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Which mode the agents really run in. The configured greenstruct.mode (LIVE, HYBRID, REPLAY) only applies
 * when Bedrock credentials exist; without them everything is REPLAY, whatever the setting says.
 */
public final class AgentModes {

    public enum Mode { LIVE, HYBRID, REPLAY }

    private static final Logger log = LoggerFactory.getLogger(AgentModes.class);

    private final Mode effective;

    public AgentModes(String configured, boolean bedrockAvailable) {
        Mode requested = Mode.valueOf(configured);
        if (!bedrockAvailable && requested != Mode.REPLAY) {
            log.warn("No Bedrock credentials (or Bedrock disabled): greenstruct.mode={} behaves as REPLAY; the agents "
                    + "play back data/demo/golden/ and the engine still runs live", requested);
            effective = Mode.REPLAY;
        } else {
            effective = requested;
        }
    }

    public Mode effective() {
        return effective;
    }
}
