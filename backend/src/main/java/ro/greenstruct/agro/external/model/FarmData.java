package ro.greenstruct.agro.external.model;

import com.fasterxml.jackson.databind.JsonNode;

/** APIA answer: the farm and its parcels as a GeoJSON FeatureCollection (with risk layers in properties). */
public record FarmData(FarmInfo farm, JsonNode parcels) {
}
