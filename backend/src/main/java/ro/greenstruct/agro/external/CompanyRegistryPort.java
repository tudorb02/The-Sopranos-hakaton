package ro.greenstruct.agro.external;

import java.util.Optional;

import ro.greenstruct.agro.external.model.CompanyRecord;

/** ANAF / ONRC lookup by CUI. */
public interface CompanyRegistryPort {

    Optional<CompanyRecord> company(String cui);
}
