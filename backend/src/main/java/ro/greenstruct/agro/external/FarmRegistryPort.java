package ro.greenstruct.agro.external;

import java.util.Optional;

import ro.greenstruct.agro.external.model.FarmData;

/** APIA / IACS farm data, available with the farmer's consent. */
public interface FarmRegistryPort {

    Optional<FarmData> farm(String cui);
}
