// need typed definitions from @mapbox/mapbox-gl-language
/* eslint-disable */
// @ts-nocheck

import MapboxLanguage from "@mapbox/mapbox-gl-language";
import mapboxgl from "mapbox-gl";

function resolvedLanguageToMapboxLanguage(
  resolvedLanguage: "zh" | "en"
): string {
  if (resolvedLanguage === "zh") {
    return "zh-Hans";
  } else {
    return "en";
  }
}

export function initLanguageControl(
  map: mapboxgl.Map,
  defaultResolvedLanguage: string
): (resolvedLanguage: string) => void {
  // TODO: the language type is not type safe
  const language = new MapboxLanguage({
    defaultLanguage: resolvedLanguageToMapboxLanguage(defaultResolvedLanguage),
  });
  map.addControl(language);
  return (resolvedLanguage) => {
    map.setStyle(
      language.setLanguage(
        map.getStyle(),
        resolvedLanguageToMapboxLanguage(resolvedLanguage)
      )
    );
  };
}
