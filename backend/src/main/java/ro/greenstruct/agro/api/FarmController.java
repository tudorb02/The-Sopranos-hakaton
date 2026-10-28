package ro.greenstruct.agro.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ro.greenstruct.agro.farm.FarmProfile;
import ro.greenstruct.agro.farm.FarmProfileService;

@RestController
@RequestMapping("/api/farms")
public class FarmController {

    private final FarmProfileService farmProfiles;

    public FarmController(FarmProfileService farmProfiles) {
        this.farmProfiles = farmProfiles;
    }

    /** Step 1 of the wizard: the farmer types the CUI and confirms what we found. */
    @GetMapping("/{cui}")
    public FarmProfile get(@PathVariable String cui) {
        return farmProfiles.get(cui);
    }
}
