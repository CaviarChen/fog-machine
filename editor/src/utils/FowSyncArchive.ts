import JSZip from "jszip";
import { FogMap } from "./FogMap";

function basename(path: string): string {
  return path.replace(/^.*[\\/]/, "");
}

export async function importFowSyncZip(data: ArrayBuffer): Promise<FogMap> {
  const zip = await new JSZip().loadAsync(data);
  const hasSyncFolder = Object.keys(zip.files).some((filename) =>
    filename.toLowerCase().includes("sync/")
  );
  const tileFiles = await Promise.all(
    Object.entries(zip.files)
      .filter(([filename, file]) => {
        if (file.dir) {
          return false;
        }
        if (hasSyncFolder && !filename.toLowerCase().includes("sync/")) {
          return false;
        }
        return basename(filename) !== "";
      })
      .map(async ([filename, file]) => {
        const data = await file.async("arraybuffer");
        return [basename(filename), data] as [string, ArrayBuffer];
      })
  );
  return FogMap.createFromFiles(tileFiles);
}

export async function exportFowSync(fogMap: FogMap): Promise<Blob | null> {
  const zip = new JSZip();
  zip.folder("Sync");
  Object.values(fogMap.tiles).forEach((tile) => {
    // just in case
    if (Object.entries(tile.blocks).length !== 0) {
      zip.file("Sync/" + tile.filename, tile.dump());
    }
  });
  return zip.generateAsync({ type: "blob" });
}
