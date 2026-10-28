package ro.greenstruct.agro.farm;

/** The CUI is unknown to ANAF, or the company exists but has no farm data at APIA; the message says which. */
public class FarmNotFoundException extends RuntimeException {

    public FarmNotFoundException(String messageRo) {
        super(messageRo);
    }
}
