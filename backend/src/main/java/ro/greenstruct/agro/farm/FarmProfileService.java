package ro.greenstruct.agro.farm;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import ro.greenstruct.agro.external.CompanyRegistryPort;
import ro.greenstruct.agro.external.FarmRegistryPort;
import ro.greenstruct.agro.external.OpenBankingPort;
import ro.greenstruct.agro.external.mock.MockDataSources;
import ro.greenstruct.agro.external.model.CompanyRecord;
import ro.greenstruct.agro.external.model.DataSourceInfo;
import ro.greenstruct.agro.external.model.FarmData;

@Service
public class FarmProfileService {

    private final CompanyRegistryPort companies;
    private final FarmRegistryPort farms;
    private final OpenBankingPort banking;
    private final MockDataSources mockSources;

    public FarmProfileService(CompanyRegistryPort companies, FarmRegistryPort farms, OpenBankingPort banking,
                              MockDataSources mockSources) {
        this.companies = companies;
        this.farms = farms;
        this.banking = banking;
        this.mockSources = mockSources;
    }

    /**
     * Company from ANAF (or the demo files), farm and parcels from APIA, cash flow from Open Banking.
     * Throws FarmNotFoundException when ANAF does not know the CUI or APIA has no farm for it.
     */
    public FarmProfile get(String cui) {
        CompanyRecord company = companies.company(cui)
                .orElseThrow(() -> new FarmNotFoundException("Nu am găsit firma cu CUI " + cui + " la ANAF"));
        FarmData farm = farms.farm(cui).orElseThrow(() -> new FarmNotFoundException("Firma "
                + company.company().name() + " (CUI " + company.company().cui() + ") există la ANAF, dar nu are o "
                + "fermă înregistrată la APIA. În demo, APIA cunoaște doar fermele demo."));
        return new FarmProfile(company.company().cui(), company.company(), farm.farm(), farm.parcels(),
                banking.cashflow(cui).orElse(null), dataSources(cui, company.source()));
    }

    /** The ANAF entry reports the real lookup; the other blocks keep the mock entries until their adapters exist. */
    private List<DataSourceInfo> dataSources(String cui, DataSourceInfo anaf) {
        List<DataSourceInfo> sources = new ArrayList<>();
        sources.add(anaf);
        mockSources.dataSources(cui).stream().filter(source -> !"ANAF".equals(source.source())).forEach(sources::add);
        return sources;
    }
}
