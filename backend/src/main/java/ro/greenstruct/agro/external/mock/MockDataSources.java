package ro.greenstruct.agro.external.mock;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.external.CompanyRegistryPort;
import ro.greenstruct.agro.external.FarmRegistryPort;
import ro.greenstruct.agro.external.OpenBankingPort;
import ro.greenstruct.agro.external.model.CashflowInfo;
import ro.greenstruct.agro.external.model.CompanyInfo;
import ro.greenstruct.agro.external.model.CompanyRecord;
import ro.greenstruct.agro.external.model.DataSourceInfo;
import ro.greenstruct.agro.external.model.FarmData;
import ro.greenstruct.agro.external.model.FarmInfo;
import ro.greenstruct.agro.modules.ReferenceData;

/**
 * ANAF, APIA and Open Banking backed by the demo farm files (copies of contracts/examples/farm-*.json without the
 * derived smeStatus).
 * A real adapter replaces one port at a time without touching the orchestrator or the agents.
 */
@Component
public class MockDataSources implements CompanyRegistryPort, FarmRegistryPort, OpenBankingPort {

    private final DemoFarmRepository farms;
    private final ObjectMapper mapper;
    private final ReferenceData reference;

    public MockDataSources(DemoFarmRepository farms, ObjectMapper mapper, ReferenceData reference) {
        this.farms = farms;
        this.mapper = mapper;
        this.reference = reference;
    }

    @Override
    public Optional<CompanyRecord> company(String cui) {
        return farms.find(cui).map(file -> new CompanyRecord(company(file.path("company")),
                dataSources(cui).stream().filter(source -> "ANAF".equals(source.source())).findFirst()
                        .orElse(new DataSourceInfo("ANAF", "MOCK", Instant.now()))));
    }

    /** True for the fictional demo farms, which must never be looked up at the real ANAF. */
    public boolean isDemoFarm(String cui) {
        return farms.find(cui).isPresent();
    }

    @Override
    public Optional<FarmData> farm(String cui) {
        return farms.find(cui).map(file -> new FarmData(convert(file.path("farm"), FarmInfo.class), file.path("parcels")));
    }

    @Override
    public Optional<CashflowInfo> cashflow(String cui) {
        return farms.find(cui).map(file -> convert(file.path("cashflow"), CashflowInfo.class));
    }

    /** Demo files record which source each block came from; real adapters report their own. */
    public List<DataSourceInfo> dataSources(String cui) {
        return farms.find(cui)
                .map(file -> mapper.convertValue(file.path("dataSources"), new TypeReference<List<DataSourceInfo>>() {
                }))
                .orElse(List.of());
    }

    /** The demo files give the balance-sheet figures; the SME status is derived from them by the same rule as for ANAF. */
    private CompanyInfo company(JsonNode node) {
        CompanyInfo info = convert(node, CompanyInfo.class);
        return info.withSmeStatus(reference.smeRule().classify(info.employees(), info.turnoverEur(), info.totalAssetsEur()));
    }

    private <T> T convert(JsonNode node, Class<T> type) {
        try {
            return mapper.treeToValue(node, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Invalid demo farm data for " + type.getSimpleName(), e);
        }
    }
}
