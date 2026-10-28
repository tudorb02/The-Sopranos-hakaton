package ro.greenstruct.agro.tools.technical;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.storage.StoredDocument;

/**
 * The only LLM step inside a tool: reads a PDF and returns the input of submit_offer_extraction
 * (contracts/schemas/submit_offer_extraction.json), raw text only. Implemented on Bedrock by the AI engineer;
 * the backend then parses the numbers deterministically.
 */
public interface DocumentExtractor {

    JsonNode extract(StoredDocument document, byte[] content, ModuleDefinition module) throws Exception;
}
