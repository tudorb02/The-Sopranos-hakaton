package ro.greenstruct.agro.external.model;

/** A company lookup together with where it came from (ANAF live, cache or the demo files). */
public record CompanyRecord(CompanyInfo company, DataSourceInfo source) {
}
